use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::AppState;

fn tauri_url(route: &str) -> WebviewUrl {
    WebviewUrl::App(format!("index.html#/{}", route).into())
}

#[derive(Serialize)]
pub struct MemoryInfo {
    pub app_mb: f64,
    pub sidecar_mb: f64,
}

fn get_process_rss_kb(pid: u32) -> u64 {
    let output = std::process::Command::new("ps")
        .args(["-o", "rss=", "-p", &pid.to_string()])
        .output();
    match output {
        Ok(out) => {
            let s = String::from_utf8_lossy(&out.stdout);
            s.trim().parse().unwrap_or(0)
        }
        Err(_) => 0,
    }
}

#[tauri::command]
pub fn get_memory_usage() -> MemoryInfo {
    let app_pid = std::process::id();

    let sidecar_pid: u32 = std::process::Command::new("lsof")
        .args(["-t", "-i", ":7777"])
        .output()
        .ok()
        .and_then(|out| {
            String::from_utf8_lossy(&out.stdout)
                .split_whitespace()
                .next()
                .and_then(|s| s.parse().ok())
        })
        .unwrap_or(0);

    let app_kb = get_process_rss_kb(app_pid);
    let sidecar_kb = if sidecar_pid > 0 {
        get_process_rss_kb(sidecar_pid)
    } else {
        0
    };

    MemoryInfo {
        app_mb: app_kb as f64 / 1024.0,
        sidecar_mb: sidecar_kb as f64 / 1024.0,
    }
}


#[derive(Serialize, Deserialize, Clone)]
pub struct DisplayInfo {
    pub id: u32,
    pub name: String,
    pub width: i32,
    pub height: i32,
    pub x: i32,
    pub y: i32,
    pub is_primary: bool,
    pub scale_factor: f64,
}

#[tauri::command]
pub async fn get_displays(app: tauri::AppHandle) -> Result<Vec<DisplayInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().map_err(|e| e.to_string())?;
    let primary_id: String = primary.as_ref().and_then(|m| m.name()).map(|s| s.to_string()).unwrap_or_default();

    let displays: Vec<DisplayInfo> = monitors
        .into_iter()
        .enumerate()
        .map(|(i, m)| {
            let pos = m.position();
            let size = m.size();
            let name = m.name().map(|s| s.to_string()).unwrap_or_default();
            let id: u32 = name
                .rsplit('#')
                .next()
                .and_then(|s| s.trim().parse().ok())
                .unwrap_or_else(|| {
                    let hash = name.len() as u32 * 1000 + pos.x as u32 + pos.y as u32 + i as u32;
                    if hash == 0 { 1 } else { hash }
                });
            DisplayInfo {
                id,
                name: name.clone(),
                width: size.width as i32,
                height: size.height as i32,
                x: pos.x,
                y: pos.y,
                is_primary: name == primary_id,
                scale_factor: m.scale_factor(),
            }
        })
        .collect();

    Ok(displays)
}

fn display_bounds(
    display: &DisplayInfo,
) -> (f64, f64, f64, f64) {
    let width = display.width as f64;
    let height = display.height as f64;
    let x = display.x as f64;
    let y = display.y as f64;
    (width, height, x, y)
}

fn build_label(prefix: &str, display_id: u32) -> String {
    format!("{}-{}", prefix, display_id)
}

#[tauri::command]
pub async fn open_live_window(
    app: tauri::AppHandle,
    display: DisplayInfo,
) -> Result<(), String> {
    let label = build_label("live", display.id);
    let (width, height, x, y) = display_bounds(&display);

    let window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html#/live-screen/{}", display.id).into()),
    )
    .title(format!("Live - {}", display.name))
    .position(x as f64, y as f64)
    .inner_size(width, height)
    .fullscreen(true)
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    window.show().map_err(|e| e.to_string())?;

    let _ = app.emit("live-window-opened", &display);
    Ok(())
}

#[tauri::command]
pub async fn open_stage_window(
    app: tauri::AppHandle,
    display: DisplayInfo,
) -> Result<(), String> {
    let label = build_label("stage", display.id);
    let (width, height, x, y) = display_bounds(&display);

    let window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html#/stage-screen/{}", display.id).into()),
    )
    .title(format!("Stage - {}", display.name))
    .position(x as f64, y as f64)
    .inner_size(width, height)
    .fullscreen(true)
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    window.show().map_err(|e| e.to_string())?;

    let _ = app.emit("stage-window-opened", &display);
    Ok(())
}

#[tauri::command]
pub async fn open_tag_songs_window(app: tauri::AppHandle) -> Result<(), String> {
    let label = "tag-song-editor";

    if let Some(window) = app.get_webview_window(label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        label,
        tauri_url("tagSongEditor"),
    )
    .title("Editor de etiquetas")
    .inner_size(950.0, 400.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn open_stage_control_window(app: tauri::AppHandle) -> Result<(), String> {
    let label = "stage-control";

    if let Some(window) = app.get_webview_window(label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        label,
        tauri_url("stage-control"),
    )
    .title("Control de Escenario")
    .inner_size(900.0, 700.0)
    .min_inner_size(900.0, 620.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn open_presentation_window(
    app: tauri::AppHandle,
    presentation_id: String,
) -> Result<(), String> {
    let label = format!("editor-presentation-{}", presentation_id);

    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html#/presentation/{}", presentation_id).into()),
    )
    .title("Editor de presentaciones")
    .inner_size(1100.0, 750.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_screen_window(app: tauri::AppHandle, label: String) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn close_all_screens(app: tauri::AppHandle) -> Result<(), String> {
    let screen_labels: Vec<String> = app
        .webview_windows()
        .iter()
        .filter(|(label, _)| label.starts_with("live-") || label.starts_with("stage-"))
        .map(|(label, _)| label.clone())
        .collect();

    for label in screen_labels {
        if let Some(window) = app.get_webview_window(&label) {
            window.close().map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}


#[tauri::command]
pub async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    let label = "settings";

    if let Some(window) = app.get_webview_window(label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        label,
        tauri_url("settings"),
    )
    .title("Ajustes")
    .inner_size(900.0, 700.0)
    .min_inner_size(900.0, 620.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn open_song_editor(
    app: tauri::AppHandle,
    song_id: String,
) -> Result<(), String> {
    let label = format!("editor-song-{}", song_id);

    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html#/song/{}", song_id).into()),
    )
    .title("Editor de canciones")
    .inner_size(900.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn open_theme_editor(
    app: tauri::AppHandle,
    theme_id: String,
) -> Result<(), String> {
    let label = format!("editor-theme-{}", theme_id);

    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html#/theme/{}", theme_id).into()),
    )
    .title("Editor de tema")
    .inner_size(900.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_app_windows(app: tauri::AppHandle) -> Result<(), String> {
    use std::sync::atomic::Ordering;

    if let Some(state) = app.try_state::<AppState>() {
        state.close_confirmed.store(true, Ordering::SeqCst);
        state.kill_flag.store(true, Ordering::SeqCst);
        if let Ok(mut guard) = state.sidecar.lock() {
            guard.take();
        }
    }

    for (_, window) in app.webview_windows() {
        let _ = window.close();
    }
    Ok(())
}
