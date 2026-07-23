#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_shell::init())
    // OS notifications for trip offers — the rider's phone is usually pocketed,
    // so in-app toasts alone are not enough to surface a new mission.
    .plugin(tauri_plugin_notification::init())
    // TEMPORARILY DISABLED — see the note in Cargo.toml. Without the plugin the
    // JS updater's `plugin:freshon-ota|status` call rejects, createOtaUpdater
    // reports "no-runtime", and self-update is inert (the app still runs).
    // .plugin(tauri_plugin_freshon_ota::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
