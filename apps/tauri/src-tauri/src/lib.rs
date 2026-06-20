mod commands;
mod sidecar;

use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use commands::*;

struct SidecarChild(std::process::Child);

impl Drop for SidecarChild {
    fn drop(&mut self) {
        let pid = self.0.id();
        let _ = self.0.kill();
        // Also kill by port to catch all descendant processes (npx -> tsx -> node chain)
        let _ = std::process::Command::new("lsof")
            .args(["-t", "-i", ":7777"])
            .output()
            .and_then(|out| {
                let pids = String::from_utf8_lossy(&out.stdout);
                for pid in pids.split_whitespace() {
                    let _ = std::process::Command::new("kill")
                        .args(["-9", pid])
                        .output();
                }
                Ok::<(), std::io::Error>(())
            });
        println!("[Sidecar] Killed sidecar processes (main pid: {})", pid);
    }
}

struct AppState {
    sidecar: std::sync::Mutex<Option<SidecarChild>>,
    kill_flag: std::sync::Arc<AtomicBool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        sidecar: std::sync::Mutex::new(None),
        kill_flag: std::sync::Arc::new(AtomicBool::new(false)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            init_app(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_displays,
            get_memory_usage,
            open_live_window,
            open_stage_window,
            open_settings_window,
            open_song_editor,
            open_theme_editor,
            open_presentation_window,
            open_stage_control_window,
            open_tag_songs_window,
            close_screen_window,
            close_all_screens,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    state.kill_flag.store(true, Ordering::SeqCst);
                    if let Ok(mut guard) = state.sidecar.lock() {
                        guard.take(); // SidecarChild::drop calls kill()
                    }
                }
            }
        });
}

fn init_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();

    let splash = WebviewWindowBuilder::new(
        &app_handle,
        "splash",
        WebviewUrl::App("splash.html".into()),
    )
    .title("Ecclesia")
    .inner_size(500.0, 400.0)
    .resizable(false)
    .decorations(false)
    .center()
    .build()?;
    splash.show()?;
    println!("[Splash] Window shown, waiting for sidecar...");

    // Spawn sidecar in background thread
    let sidecar_app = app.handle().clone();
    let kill_flag = app.state::<AppState>().kill_flag.clone();
    std::thread::spawn(move || {
        match sidecar::spawn_sidecar(&sidecar_app) {
            Ok(Some(c)) => {
                let state = sidecar_app.state::<AppState>();
                if let Ok(mut guard) = state.sidecar.lock() {
                    *guard = Some(SidecarChild(c));
                }
                // Wait for kill signal
                while !kill_flag.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                // guard dropped here -> SidecarChild::drop calls kill()
                println!("[Sidecar] Kill flag set, dropping SidecarChild");
            }
            Ok(None) => {
                println!("[Sidecar] Using existing sidecar on port 7777");
            }
            Err(e) => {
                eprintln!("[Sidecar] Failed to start: {}", e);
            }
        }
    });

    // Block init until API is fully ready (HTTP check)
    println!("[Init] Waiting for API to be ready...");
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);
    let mut api_ready = false;
    while !api_ready && std::time::Instant::now() < deadline {
        if let Ok(mut stream) = std::net::TcpStream::connect_timeout(
            &"127.0.0.1:7777".parse().unwrap(),
            std::time::Duration::from_secs(2),
        ) {
            stream.set_read_timeout(Some(std::time::Duration::from_secs(5))).ok();
            stream.set_write_timeout(Some(std::time::Duration::from_secs(5))).ok();
            let req = b"GET /api/remote/info HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
            if stream.write_all(req).is_ok() {
                let mut body = Vec::new();
                let mut buf = [0u8; 256];
                loop {
                    match stream.read(&mut buf) {
                        Ok(0) => break,
                        Ok(n) => body.extend_from_slice(&buf[..n]),
                        Err(_) => break,
                    }
                }
                let body_str = String::from_utf8_lossy(&body);
                if body_str.contains("\"name\"") {
                    println!("[Init] API fully ready!");
                    api_ready = true;
                    break;
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }

    if !api_ready {
        eprintln!("[Init] Timeout waiting for API!");
    }

    let _ = splash.close();
    println!("[Init] Creating main window...");

    let _main = WebviewWindowBuilder::new(
        &app_handle,
        "main",
        WebviewUrl::App("index.html".into()),
    )
    .title("Ecclesia")
    .inner_size(1280.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .disable_drag_drop_handler()
    .build()?;
    let _ = app_handle.emit("sidecar-ready", true);

    let shortcuts = app.global_shortcut();
    for key in &["F7", "F9", "F10", "F11", "Escape"] {
        let handler = move |h: &tauri::AppHandle, s: &Shortcut, e: ShortcutEvent| {
            if e.state == ShortcutState::Pressed {
                let msg = match s.to_string().as_str() {
                    k if k.contains("F7") => "activate-live",
                    k if k.contains("F9") => "toggle-text",
                    k if k.contains("F10") => "show-logo",
                    k if k.contains("F11") => "black-screen",
                    k if k.contains("Escape") => "clear-live",
                    _ => return,
                };
                let _ = h.emit("shortcut", msg);
            }
        };
        shortcuts.on_shortcut(*key, handler)?;
    }

    Ok(())
}
