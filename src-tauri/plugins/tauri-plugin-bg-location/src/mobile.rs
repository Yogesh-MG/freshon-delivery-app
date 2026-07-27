use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;
use crate::Result;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.freshon.delivery.bglocation";

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    #[allow(unused_variables)] api: PluginApi<R, C>,
) -> Result<BgLocation<R>> {
    #[cfg(target_os = "android")]
    {
        let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "BgLocationPlugin")?;
        return Ok(BgLocation(Some(handle)));
    }
    // iOS is not built for this app; the commands become no-ops if it ever is.
    #[cfg(not(target_os = "android"))]
    Ok(BgLocation(None))
}

/// Android access to the native `BgLocationPlugin`. `None` on any non-Android
/// mobile target so the commands degrade to no-ops rather than failing to link.
pub struct BgLocation<R: Runtime>(Option<PluginHandle<R>>);

impl<R: Runtime> BgLocation<R> {
    pub fn start_tracking(&self, args: StartTrackingArgs) -> Result<()> {
        match &self.0 {
            Some(handle) => handle
                .run_mobile_plugin::<EmptyResponse>("startTracking", args)
                .map(|_| ())
                .map_err(Into::into),
            None => Ok(()),
        }
    }

    pub fn stop_tracking(&self) -> Result<()> {
        match &self.0 {
            Some(handle) => handle
                .run_mobile_plugin::<EmptyResponse>("stopTracking", ())
                .map(|_| ())
                .map_err(Into::into),
            None => Ok(()),
        }
    }
}
