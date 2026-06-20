mod commands;
mod sidecar;

use tauri::{Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use commands::*;

struct AppState {
    sidecar: std::sync::Mutex<Option<std::process::Child>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        sidecar: std::sync::Mutex::new(None),
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
                    if let Ok(mut guard) = state.sidecar.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
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
        WebviewUrl::External("http://localhost:5173/splash.html".parse()?),
    )
    .title("Ecclesia")
    .inner_size(500.0, 400.0)
    .resizable(false)
    .decorations(false)
    .center()
    .build()?;

    // Spawn sidecar in background thread, store handle in app state
    let sidecar_app = app.handle().clone();
    std::thread::spawn(move || {
        match sidecar::spawn_sidecar(&sidecar_app) {
            Ok(Some(child)) => {
                let state = sidecar_app.state::<AppState>();
                if let Ok(mut guard) = state.sidecar.lock() {
                    *guard = Some(child);
                }
                loop { std::thread::sleep(std::time::Duration::from_secs(u64::MAX)) }
            }
            Ok(None) => println!("[Sidecar] Using existing sidecar on port 7777"),
            Err(e) => eprintln!("[Sidecar] Failed to start: {}", e),
        }
    });

    // Wait for sidecar to be ready, then close splash and create main window
    let splash_for_main = splash.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            if std::net::TcpStream::connect_timeout(
                &"127.0.0.1:7777".parse().unwrap(),
                std::time::Duration::from_millis(100),
            )
            .is_ok()
            {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        let _ = splash_for_main.close();
        println!("[Sidecar] Ready, creating main window");

        let main = WebviewWindowBuilder::new(
            &app_handle,
            "main",
            WebviewUrl::External("http://localhost:5173/index.html".parse().unwrap()),
        )
        .title("Ecclesia")
        .inner_size(1280.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .build();

        match main {
            Ok(_) => {
                let _ = app_handle.emit("sidecar-ready", true);
            }
            Err(e) => eprintln!("[Main] Failed to create window: {}", e),
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

    Ok(())
}
