//! Foreground-service location tracking for the FreshOn delivery rider app.
//!
//! Scope: tracks ONLY while a delivery is active. The JS layer starts the
//! service when the rider accepts work and stops it when the trip completes or
//! is cancelled. A persistent notification is shown for the duration (required
//! by Android for a location foreground service). Because a foreground service
//! keeps running when the app is backgrounded or the screen is off, this covers
//! the real delivery need WITHOUT the `ACCESS_BACKGROUND_LOCATION` permission or
//! a Google Play background-location review.
//!
//! Android only. Desktop/iOS builds get no-op commands so the app still runs.

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
mod error;
mod models;

pub use error::{Error, Result};
pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

#[cfg(desktop)]
use desktop::BgLocation;
#[cfg(mobile)]
use mobile::BgLocation;

/// Extension trait so any `Manager` (App, AppHandle, Window) can reach the
/// managed `BgLocation` handle: `app.bg_location().start_tracking(..)`.
pub trait BgLocationExt<R: Runtime> {
    fn bg_location(&self) -> &BgLocation<R>;
}

impl<R: Runtime, T: Manager<R>> BgLocationExt<R> for T {
    fn bg_location(&self) -> &BgLocation<R> {
        self.state::<BgLocation<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("bg-location")
        .invoke_handler(tauri::generate_handler![
            commands::start_tracking,
            commands::stop_tracking
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let bg_location = mobile::init(app, api)?;
            #[cfg(desktop)]
            let bg_location = desktop::init(app, api)?;
            app.manage(bg_location);
            Ok(())
        })
        .build()
}
