mod commands;
mod sidecar;

use tauri::Emitter;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(init_app)
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn init_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    sidecar::spawn_sidecar(app.handle())?;

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

    let _main = tauri::WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::App("index-tauri.html".into()),
    )
    .title("Ecclesia")
    .inner_size(1280.0, 800.0)
    .min_inner_size(900.0, 600.0)
    .build()?;

    let _ = app.emit("sidecar-ready", true);
    Ok(())
}
