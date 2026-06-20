use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};


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
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            let name = m.name().map(|s| s.to_string()).unwrap_or_default();
            DisplayInfo {
                id: name.parse().unwrap_or(0),
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
        WebviewUrl::App(format!("live-screen/{}", display.id).into()),
    )
    .title(format!("Live - {}", display.name))
    .position(x as f64, y as f64)
    .inner_size(width, height)
    .fullscreen(true)
    .decorations(false)
    .always_on_top(true)
    .build()
    .map_err(|e| e.to_string())?;

    window.show().map_err(|e| e.to_string())?;
    window.set_focus().ok();

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
        WebviewUrl::App(format!("stage-screen/{}", display.id).into()),
    )
    .title(format!("Stage - {}", display.name))
    .position(x as f64, y as f64)
    .inner_size(width, height)
    .fullscreen(true)
    .decorations(false)
    .always_on_top(false)
    .build()
    .map_err(|e| e.to_string())?;

    window.show().map_err(|e| e.to_string())?;
    window.set_focus().ok();

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
        WebviewUrl::App("tagSongEditor".into()),
    )
    .title("Editor de etiquetas")
    .inner_size(700.0, 600.0)
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
        WebviewUrl::App("stage-control".into()),
    )
    .title("Control de escenario")
    .inner_size(700.0, 600.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn open_presentation_window(
    app: tauri::AppHandle,
    presentation_id: String,
) -> Result<(), String> {
    let label = format!("presentation-editor-{}", presentation_id);

    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("presentation/{}", presentation_id).into()),
    )
    .title("Editor de presentación")
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
        WebviewUrl::App("settings".into()),
    )
    .title("Configuración")
    .inner_size(900.0, 700.0)
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
    let label = format!("song-editor-{}", song_id);

    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("song/{}", song_id).into()),
    )
    .title("Editor de canción")
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
    let label = format!("theme-editor-{}", theme_id);

    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().ok();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("theme/{}", theme_id).into()),
    )
    .title("Editor de tema")
    .inner_size(900.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
