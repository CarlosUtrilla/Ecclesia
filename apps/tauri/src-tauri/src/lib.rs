mod commands;
mod sidecar;

use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_utils::config::Color;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use commands::*;

pub struct SidecarChild(std::process::Child);

impl Drop for SidecarChild {
    #[cfg(unix)]
    fn drop(&mut self) {
        let pid = self.0.id();
        unsafe { libc::killpg(pid as i32, libc::SIGKILL) };
        let _ = std::process::Command::new("lsof")
            .args(["-t", "-i", ":7777"])
            .output()
            .map(|o| {
                let s = String::from_utf8_lossy(&o.stdout);
                for line in s.lines() {
                    if let Ok(pid) = line.trim().parse::<u32>() {
                        unsafe { libc::kill(pid as i32, libc::SIGKILL) };
                    }
                }
            });
        println!("[Sidecar] Killed sidecar processes (main pid: {})", pid);
    }

    #[cfg(not(unix))]
    fn drop(&mut self) {
        let _ = self.0.kill();
        println!("[Sidecar] Killed sidecar process");
    }
}

pub struct AppState {
    pub sidecar: std::sync::Mutex<Option<SidecarChild>>,
    pub kill_flag: std::sync::Arc<AtomicBool>,
    pub close_confirmed: std::sync::Arc<AtomicBool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        sidecar: std::sync::Mutex::new(None),
        kill_flag: std::sync::Arc::new(AtomicBool::new(false)),
        close_confirmed: std::sync::Arc::new(AtomicBool::new(false)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            close_app_windows,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { ref api, .. } = event {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    if !state.close_confirmed.load(Ordering::SeqCst) {
                        api.prevent_exit();
                    }
                }
            }
            if let RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    state.kill_flag.store(true, Ordering::SeqCst);
                    if let Ok(mut guard) = state.sidecar.lock() {
                        guard.take();
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
    .inner_size(480.0, 300.0)
    .resizable(false)
    .center()
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .background_color(Color(9, 9, 11, 255))
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
    } else {
        // Pequeña pausa para asegurar que migraciones y datos estén listos
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    let _ = splash.close();
    println!("[Init] Creating main window...");

    let _main = WebviewWindowBuilder::new(
        &app_handle,
        "main",
        WebviewUrl::App("index.html".into()),
    )
    .title("Ecclesia")
    .inner_size(1200.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .maximized(true)
    .background_color(Color(9, 9, 11, 255))
    .disable_drag_drop_handler()
    .build()?;
    let _ = app_handle.emit("sidecar-ready", true);

    // Diálogo de confirmación al cerrar la ventana principal (como Electron)
    let main_window = app_handle.get_webview_window("main").unwrap();
    let app_clone = app_handle.clone();
    let state_clone = app.state::<AppState>().close_confirmed.clone();
    main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if state_clone.load(Ordering::SeqCst) {
                return;
            }
            api.prevent_close();
            let _ = app_clone.emit("app-close-requested", ());
        }
    });

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

    // Cmd+Q → cerrar ventana principal (mismo flujo que Cmd+W)
    let app_for_q = app.handle().clone();
    shortcuts.on_shortcut("CmdOrCtrl+Q", move |_h, _s, e| {
        if e.state == ShortcutState::Pressed {
            if let Some(window) = app_for_q.get_webview_window("main") {
                let _ = window.close();
            }
        }
    })?;

    Ok(())
}
