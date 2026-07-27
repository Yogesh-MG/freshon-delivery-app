use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;
use crate::Result;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<BgLocation<R>> {
    Ok(BgLocation(app.clone()))
}

/// Desktop stub — there is no foreground service to run, so the commands are
/// harmless no-ops. Keeps `npm run tauri dev` on a laptop working. Holds the
/// `AppHandle` (which is `Send + Sync`) so it can be `.manage()`d as state.
pub struct BgLocation<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> BgLocation<R> {
    pub fn start_tracking(&self, _args: StartTrackingArgs) -> Result<()> {
        log::info!("[bg-location] start_tracking is a no-op on desktop");
        Ok(())
    }

    pub fn stop_tracking(&self) -> Result<()> {
        log::info!("[bg-location] stop_tracking is a no-op on desktop");
        Ok(())
    }
}
