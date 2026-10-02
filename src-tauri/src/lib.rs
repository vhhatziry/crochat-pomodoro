use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use tauri::{AppHandle, Manager};
mod pattern_export;
use pattern_export::{export_pattern_pdf, pattern_design};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

fn unique_paths(paths: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    paths
        .into_iter()
        .filter(|path| {
            let key = path.replace('\\', "/");
            #[cfg(windows)]
            let key = key.to_lowercase();
            seen.insert(key)
        })
        .collect()
}

const STORE_FILE: &str = "crochat-store.json";
const KEY_PATRONES: &str = "patrones";
const KEY_THEME: &str = "theme";
const KEY_CONFIG: &str = "config";
const KEY_PDFS: &str = "pdfList";
const KEY_IMAGES: &str = "imageList";

/// A crochet pattern note persisted locally.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patron {
    pub id: String,
    pub title: String,
    pub body: String,
    /// Optional stitch/row counter for the pattern.
    #[serde(default)]
    pub counter: i64,
}

/// User-tunable Pomodoro durations (seconds) and long-break cadence.
fn default_gallery_sec() -> i64 {
    3
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroConfig {
    pub work_sec: i64,
    pub short_sec: i64,
    pub long_sec: i64,
    pub long_every: i64,
    #[serde(default = "default_gallery_sec")]
    pub gallery_sec: i64,
}

/// Persist the full list of patterns to the local store.
#[tauri::command]
fn save_patrones(app: AppHandle, patrones: Vec<Patron>) -> Result<(), String> {
    let mut ids = HashSet::new();
    for patron in &patrones {
        if patron.id.trim().is_empty() || !ids.insert(&patron.id) {
            return Err(
                "Hay IDs de patrones vacíos o repetidos. No se modificaron tus datos.".into(),
            );
        }
        if patron.counter < 0 {
            return Err("El contador no puede ser negativo.".into());
        }
    }
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(&patrones).map_err(|e| e.to_string())?;
    store.set(KEY_PATRONES, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the stored patterns (empty list on first run).
#[tauri::command]
fn load_patrones(app: AppHandle) -> Result<Vec<Patron>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    match store.get(KEY_PATRONES) {
        Some(value) => serde_json::from_value(value).map_err(|e| e.to_string()),
        None => Ok(Vec::new()),
    }
}

/// Persist the selected theme ("green" | "purple").
#[tauri::command]
fn save_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(KEY_THEME, json!(theme));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the stored theme, defaulting to "green".
#[tauri::command]
fn load_theme(app: AppHandle) -> Result<String, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let theme = store
        .get(KEY_THEME)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "green".to_string());
    Ok(theme)
}

/// Persist the Pomodoro configuration (durations + long-break cadence).
#[tauri::command]
fn save_config(app: AppHandle, config: PomodoroConfig) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(&config).map_err(|e| e.to_string())?;
    store.set(KEY_CONFIG, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the stored configuration (None on first run so the UI keeps defaults).
#[tauri::command]
fn load_config(app: AppHandle) -> Result<Option<PomodoroConfig>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    match store.get(KEY_CONFIG) {
        Some(value) => serde_json::from_value(value)
            .map(Some)
            .map_err(|e| e.to_string()),
        None => Ok(None),
    }
}

/// Persist the user's PDF pattern library (list of absolute file paths).
#[tauri::command]
fn save_pdfs(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(KEY_PDFS, json!(unique_paths(paths)));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the stored PDF library (empty list on first run).
#[tauri::command]
fn load_pdfs(app: AppHandle) -> Result<Vec<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    match store.get(KEY_PDFS) {
        Some(value) => serde_json::from_value(value).map_err(|e| e.to_string()),
        None => Ok(Vec::new()),
    }
}

/// Persist the user's image gallery (list of absolute image paths).
#[tauri::command]
fn save_images(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(KEY_IMAGES, json!(unique_paths(paths)));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Read the stored image gallery (empty list on first run).
#[tauri::command]
fn load_images(app: AppHandle) -> Result<Vec<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    match store.get(KEY_IMAGES) {
        Some(value) => serde_json::from_value(value).map_err(|e| e.to_string()),
        None => Ok(Vec::new()),
    }
}

/// Fire a native OS notification (used when a Pomodoro cycle ends).
#[tauri::command]
fn notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_patrones,
            load_patrones,
            save_theme,
            load_theme,
            save_config,
            load_config,
            save_pdfs,
            load_pdfs,
            save_images,
            load_images,
            pattern_design,
            export_pattern_pdf,
            notify
        ])
        .run(tauri::generate_context!())
        .expect("error while running CrocHat");
}
