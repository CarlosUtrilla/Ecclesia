use std::path::PathBuf;
use std::process::{Child, Command};
use tauri::Manager;

/// Attempts to find the sidecar JS bundle at various locations.
/// Returns the path if found.
fn find_sidecar(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    // 1. Sidecar bundled as Tauri resource
    let resource_dir = app.path().resource_dir().ok()?;
    let resource_path = resource_dir.join("sidecar.js");
    if resource_path.exists() {
        return Some(resource_path);
    }

    // 2. Development: try relative to CARGO_MANIFEST_DIR (set by cargo)
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let dev_path = PathBuf::from(manifest_dir)
            .parent()?
            .parent()?
            .join("api/dist/sidecar.js");
        if dev_path.exists() {
            return Some(dev_path);
        }
    }

    // 3. Development: try current working directory (apps/tauri/ or project root)
    if let Ok(cwd) = std::env::current_dir() {
        // Check in apps/api/dist/sidecar.js relative to cwd
        let from_cwd = cwd.join("../api/dist/sidecar.js");
        if from_cwd.exists() {
            return Some(from_cwd);
        }
        let from_cwd_root = cwd.join("apps/api/dist/sidecar.js");
        if from_cwd_root.exists() {
            return Some(from_cwd_root);
        }
    }

    None
}

const SIDECAR_PORT: u16 = 7777;

pub fn spawn_sidecar(app: &tauri::AppHandle) -> Result<(), String> {
    let user_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    std::fs::create_dir_all(&user_data_dir)
        .map_err(|e| format!("Failed to create user data dir: {}", e))?;

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    // Check if sidecar is already running (e.g. started externally in dev)
    if is_port_in_use(SIDECAR_PORT) {
        println!("[Sidecar] Port {} already in use, assuming external sidecar is running", SIDECAR_PORT);
        return Ok(());
    }

    let sidecar_path = find_sidecar(app).ok_or_else(|| {
        format!(
            "Sidecar not found. Build it first: pnpm -C apps/api build:sidecar\n\
             Searched in: {:?}",
            resource_dir.join("sidecar.js")
        )
    })?;

    // Compute cwd and resources path:
    // - dev:  cwd=apps/tauri/  resources=apps/desktop/resources
    // - release: cwd=resource_dir  resources=resource_dir
    let is_dev = std::env::var("CARGO_MANIFEST_DIR").is_ok();
    let (cwd, resources_path): (PathBuf, PathBuf) = if is_dev {
        let manifest = std::env::var("CARGO_MANIFEST_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| resource_dir.clone());
        let tauri_root = manifest.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| resource_dir.clone());
        (
            tauri_root.clone(),
            tauri_root.parent().map(|p| p.join("desktop/resources")).unwrap_or_else(|| resource_dir.clone()),
        )
    } else {
        (resource_dir.clone(), resource_dir.clone())
    };

    let child: Child = Command::new("node")
        .arg(sidecar_path.to_str().unwrap())
        .arg(format!("--port={}", SIDECAR_PORT))
        .arg(format!("--user-data-path={}", user_data_dir.to_str().unwrap()))
        .arg(format!("--resources-path={}", resources_path.to_str().unwrap_or(".")))
        .arg(format!("--cwd={}", cwd.to_str().unwrap_or(".")))
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    std::mem::drop(child);
    println!("[Sidecar] Started on port {} via {}", SIDECAR_PORT, sidecar_path.display());
    Ok(())
}

fn is_port_in_use(port: u16) -> bool {
    let addr: std::net::SocketAddr = format!("127.0.0.1:{}", port)
        .parse()
        .expect("Invalid socket address");
    std::net::TcpStream::connect_timeout(
        &addr,
        std::time::Duration::from_millis(100),
    )
    .is_ok()
}
