use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::AppState;

#[derive(Serialize, Clone)]
pub struct OAuthCallbackPayload {
    pub code: Option<String>,
    pub error: Option<String>,
}

fn tauri_url(route: &str) -> WebviewUrl {
    WebviewUrl::App(format!("index.html#/{}", route).into())
}

#[derive(Serialize)]
pub struct MemoryInfo {
    pub app_mb: f64,
    pub sidecar_mb: f64,
}

fn get_process_rss_kb(pid: u32) -> u64 {
    #[cfg(unix)]
    {
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
    #[cfg(not(unix))]
    {
        let _ = pid;
        0
    }
}

#[tauri::command]
pub fn get_memory_usage() -> MemoryInfo {
    let app_pid = std::process::id();

    #[cfg(unix)]
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

    #[cfg(not(unix))]
    let sidecar_pid: u32 = 0;

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
        .map(|(_i, m)| {
            let pos = m.position();
            let size = m.size();
            let name = m.name().map(|s| s.to_string()).unwrap_or_default();
            // Intentar extraer un id estable del nombre (p.ej. "Monitor #2" -> 2).
            // Si no es posible, generar un hash determinista basado solo en la posición
            // y el tamaño, evitando el índice de enumeración que puede variar.
            let id: u32 = name
                .rsplit('#')
                .next()
                .and_then(|s| s.trim().parse().ok())
                .unwrap_or_else(|| {
                    let hash = (pos.x.abs() as u32)
                        .wrapping_mul(73856093)
                        .wrapping_add((pos.y.abs() as u32).wrapping_mul(19349663))
                        .wrapping_add((size.width as u32).wrapping_mul(83492791))
                        .wrapping_add((size.height as u32).wrapping_mul(1000003));
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

fn build_label(prefix: &str, display_id: u32) -> String {
    format!("{}-{}", prefix, display_id)
}

// Aplica la configuración final de una ventana de presentación (live/stage).
// En macOS usamos un "simple fullscreen" simulado: ventana sin decoraciones,
// del tamaño del monitor y siempre visible, con nivel por encima de la menu bar,
// para no crear un Space nuevo como hace el fullscreen nativo de macOS.
// En otras plataformas usamos fullscreen nativo.
#[cfg(target_os = "macos")]
fn finish_presentation_window<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) -> Result<(), String> {
    use objc::runtime::Object;
    use objc::{msg_send, sel, sel_impl};

    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    let ns_window = window.ns_window().map_err(|e| e.to_string())? as *mut Object;
    unsafe {
        let () = msg_send![ns_window, setLevel: 1000isize];
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn finish_presentation_window<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) -> Result<(), String> {
    window.set_fullscreen(true).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_live_window(
    app: tauri::AppHandle,
    display: DisplayInfo,
) -> Result<u32, String> {
    let label = build_label("live", display.id);
    let scale = display.scale_factor;
    // Tauri builder usa píxeles lógicos; convertimos desde físicos.
    let logical_x = display.x as f64 / scale;
    let logical_y = display.y as f64 / scale;
    let logical_w = display.width as f64 / scale;
    let logical_h = display.height as f64 / scale;

    // Si ya existe una ventana live para este display, reutilizarla y reposicionarla.
    if let Some(window) = app.get_webview_window(&label) {
        window
            .set_position(tauri::LogicalPosition::new(logical_x, logical_y))
            .map_err(|e| e.to_string())?;
        window
            .set_size(tauri::LogicalSize::new(logical_w, logical_h))
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        finish_presentation_window(&window)?;
        let _ = app.emit("live-window-opened", &display);
        return Ok(display.id);
    }

    let window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html#/live-screen/{}", display.id).into()),
    )
    .title(format!("Live - {}", display.name))
    .position(logical_x, logical_y)
    .inner_size(logical_w, logical_h)
    .visible(false)
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    window.show().map_err(|e| e.to_string())?;
    finish_presentation_window(&window)?;

    // Devolver el foco a la ventana principal, como hace Electron.
    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(250));
        if let Some(main) = app_clone.get_webview_window("main") {
            let _ = main.set_focus();
            let _ = main.show();
        }
    });

    let _ = app.emit("live-window-opened", &display);
    Ok(display.id)
}

#[tauri::command]
pub async fn open_stage_window(
    app: tauri::AppHandle,
    display: DisplayInfo,
) -> Result<u32, String> {
    let label = build_label("stage", display.id);
    let scale = display.scale_factor;
    let logical_x = display.x as f64 / scale;
    let logical_y = display.y as f64 / scale;
    let logical_w = display.width as f64 / scale;
    let logical_h = display.height as f64 / scale;

    if let Some(window) = app.get_webview_window(&label) {
        window
            .set_position(tauri::LogicalPosition::new(logical_x, logical_y))
            .map_err(|e| e.to_string())?;
        window
            .set_size(tauri::LogicalSize::new(logical_w, logical_h))
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        finish_presentation_window(&window)?;
        let _ = app.emit("stage-window-opened", &display);
        return Ok(display.id);
    }

    let window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(format!("index.html#/stage-screen/{}", display.id).into()),
    )
    .title(format!("Stage - {}", display.name))
    .position(logical_x, logical_y)
    .inner_size(logical_w, logical_h)
    .visible(false)
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    window.show().map_err(|e| e.to_string())?;
    finish_presentation_window(&window)?;

    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(250));
        if let Some(main) = app_clone.get_webview_window("main") {
            let _ = main.set_focus();
            let _ = main.show();
        }
    });

    let _ = app.emit("stage-window-opened", &display);
    Ok(display.id)
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
        // Salir de fullscreen y quitar always-on-top antes de cerrar,
        // como hace el displayManager de Electron.
        let _ = window.set_fullscreen(false);
        let _ = window.set_always_on_top(false);
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
            let _ = window.set_fullscreen(false);
            let _ = window.set_always_on_top(false);
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

#[tauri::command]
pub async fn open_oauth_window(
    app: tauri::AppHandle,
    auth_url: String,
) -> Result<(), String> {
    let label = "oauth";
    println!("[OAuth] open_oauth_window invoked with auth_url: {}", &auth_url[..auth_url.len().min(80)]);

    if let Some(window) = app.get_webview_window(label) {
        println!("[OAuth] closing existing oauth window");
        let _ = window.close();
    }

    let url: tauri::Url = auth_url
        .parse()
        .map_err(|e| {
            eprintln!("[OAuth] invalid auth URL: {}", e);
            format!("URL de auth inválida: {}", e)
        })?;

    let app_clone = app.clone();
    let window = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(url))
        .title("Autenticación de Google")
        .inner_size(500.0, 700.0)
        .center()
        .on_navigation(move |url| {
            let url_str = url.to_string();
            println!("[OAuth] navigation: {}", url_str);
            if url_str.starts_with("http://127.0.0.1:7777/oauth-redirect") {
                let code = url
                    .query_pairs()
                    .find(|(k, _)| k == "code")
                    .map(|(_, v)| v.to_string());
                let error = url
                    .query_pairs()
                    .find(|(k, _)| k == "error")
                    .map(|(_, v)| v.to_string());

                println!("[OAuth] captured redirect code={:?} error={:?}", code.is_some(), error);
                let payload = OAuthCallbackPayload { code, error };
                let _ = app_clone.emit("oauthCodeCaptured", payload);

                if let Some(window) = app_clone.get_webview_window("oauth") {
                    let _ = window.close();
                }
                return false;
            }
            true
        })
        .build()
        .map_err(|e| {
            eprintln!("[OAuth] failed to build window: {}", e);
            e.to_string()
        })?;

    println!("[OAuth] oauth window built, showing");
    window.show().map_err(|e| e.to_string())?;
    Ok(())
}
