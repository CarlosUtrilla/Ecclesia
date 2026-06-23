use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::Duration;
use std::thread;
use tauri::{AppHandle, Manager};

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

/// Attempts to find the sidecar source file (for hot reload in dev mode).
/// Returns the path if found.
fn find_sidecar_source() -> Option<std::path::PathBuf> {
    // Try relative to CARGO_MANIFEST_DIR
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let source_path = PathBuf::from(manifest_dir)
            .parent()?
            .parent()?
            .join("api/src/standalone.ts");
        if source_path.exists() {
            return Some(source_path);
        }
    }

    // Try current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let from_cwd = cwd.join("../api/src/standalone.ts");
        if from_cwd.exists() {
            return Some(from_cwd);
        }
        let from_cwd_root = cwd.join("apps/api/src/standalone.ts");
        if from_cwd_root.exists() {
            return Some(from_cwd_root);
        }
    }

    None
}

const SIDECAR_PORT: u16 = 7777;

fn wait_for_http(timeout_secs: u64) -> Result<(), String> {
    let start = std::time::Instant::now();
    let addr: std::net::SocketAddr = format!("127.0.0.1:{}", SIDECAR_PORT)
        .parse()
        .map_err(|e| format!("Invalid socket address: {}", e))?;

    while start.elapsed().as_secs() < timeout_secs {
        if let Ok(mut stream) = std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(200)) {
            stream.set_read_timeout(Some(Duration::from_secs(3))).ok();
            stream.set_write_timeout(Some(Duration::from_secs(3))).ok();
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
                    return Ok(());
                }
            }
        }
        thread::sleep(Duration::from_millis(200));
    }
    Err(format!("Timeout waiting for API on port {}", SIDECAR_PORT))
}

pub fn spawn_sidecar(app: &AppHandle) -> Result<Option<Child>, String> {
    let user_data_dir = if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .map(|h| PathBuf::from(h).join("Library/Application Support/Ecclesia"))
            .unwrap_or_else(|_| {
                app.path().app_data_dir().unwrap_or_default()
            })
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(|h| PathBuf::from(h).join("Ecclesia"))
            .unwrap_or_else(|_| {
                app.path().app_data_dir().unwrap_or_default()
            })
    } else {
        app.path().app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?
    };

    std::fs::create_dir_all(&user_data_dir)
        .map_err(|e| format!("Failed to create user data dir: {}", e))?;

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let is_dev = std::env::var("CARGO_MANIFEST_DIR").is_ok();

    // In dev, always kill any stale process and restart fresh
    if is_dev {
        if std::net::TcpStream::connect_timeout(
            &format!("127.0.0.1:{}", SIDECAR_PORT)
                .parse()
                .unwrap(),
            Duration::from_millis(100),
        )
        .is_ok()
        {
            eprintln!("[Sidecar] Stale process on port {}, killing and restarting", SIDECAR_PORT);
            let _ = std::process::Command::new("lsof")
                .args(["-t", "-i", &format!(":{}", SIDECAR_PORT)])
                .output()
                .and_then(|out| {
                    let pid = String::from_utf8_lossy(&out.stdout);
                    std::process::Command::new("kill").args(["-9", pid.trim()]).output()
                });
            std::thread::sleep(Duration::from_millis(300));
        }
    } else {
        // In production, check if a healthy server is already running
        if std::net::TcpStream::connect_timeout(
            &format!("127.0.0.1:{}", SIDECAR_PORT)
                .parse()
                .unwrap(),
            Duration::from_millis(500),
        )
        .is_ok()
        {
            // Try HTTP check - if healthy, use existing
            let addr: std::net::SocketAddr = format!("127.0.0.1:{}", SIDECAR_PORT)
                .parse().unwrap();
            if let Ok(mut stream) = std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
                stream.set_read_timeout(Some(Duration::from_secs(3))).ok();
                stream.set_write_timeout(Some(Duration::from_secs(3))).ok();
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
                        println!("[Sidecar] Healthy server already running on port {}", SIDECAR_PORT);
                        return Ok(None);
                    }
                }
            }
        }
    }

    // Compute cwd and resources path:
    // - dev:  cwd=apps/tauri/  resources=apps/desktop/resources
    // - release: cwd=resource_dir  resources=resource_dir
    let (cwd, resources_path, env_path): (PathBuf, PathBuf, PathBuf) = if is_dev {
        let manifest = std::env::var("CARGO_MANIFEST_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| resource_dir.clone());
        let tauri_root = manifest.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| resource_dir.clone());
        // env-path debe apuntar a la raíz del proyecto donde está .env
        let project_root = tauri_root.parent().and_then(|p| p.parent()).map(|p| p.to_path_buf()).unwrap_or_else(|| resource_dir.clone());
        (
            tauri_root.clone(),
            tauri_root.parent().map(|p| p.join("desktop/resources")).unwrap_or_else(|| resource_dir.clone()),
            project_root,
        )
    } else {
        (resource_dir.clone(), resource_dir.clone(), resource_dir.clone())
    };

    // In dev mode, use tsx with source file for hot reload
    // In release mode, use node with bundled js
    let (sidecar_path, use_tsx) = if is_dev {
        if let Some(source_path) = find_sidecar_source() {
            (source_path.to_string_lossy().to_string(), true)
        } else if let Some(bundle_path) = find_sidecar(app) {
            println!("[Sidecar] Dev mode: source not found, using bundle at {}", bundle_path.display());
            (bundle_path.to_string_lossy().to_string(), false)
        } else {
            return Err(format!(
                "Sidecar not found. Build it first: pnpm -C apps/api build:sidecar"
            ));
        }
    } else {
        let sidecar_path = find_sidecar(app).ok_or_else(|| {
            format!(
                "Sidecar not found. Build it first: pnpm -C apps/api build:sidecar\n\
                 Searched in: {:?}",
                resource_dir.join("sidecar.js")
            )
        })?;
        (sidecar_path.to_string_lossy().to_string(), false)
    };

    let args = vec![
        format!("--port={}", SIDECAR_PORT),
        format!("--user-data-path={}", user_data_dir.to_str().unwrap()),
        format!("--resources-path={}", resources_path.to_str().unwrap_or(".")),
        format!("--cwd={}", cwd.to_str().unwrap_or(".")),
        format!("--env-path={}", env_path.to_str().unwrap_or(".")),
    ];

    let mut cmd = if use_tsx {
        println!("[Sidecar] Dev mode: using tsx with source file for hot reload");
        let mut c = Command::new("npx");
        c.arg("tsx").arg(&sidecar_path);
        c.current_dir(&env_path);
        for arg in &args {
            c.arg(arg);
        }
        c
    } else {
        let mut c = Command::new("node");
        c.arg(&sidecar_path);
        c.env("NODE_ENV", "production");
        for arg in &args {
            c.arg(arg);
        }
        c
    };

    let child = cmd.spawn().map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    println!("[Sidecar] Waiting for server on port {}...", SIDECAR_PORT);
    wait_for_http(30)?;
    println!("[Sidecar] Server ready on port {}", SIDECAR_PORT);

    Ok(Some(child))
}
