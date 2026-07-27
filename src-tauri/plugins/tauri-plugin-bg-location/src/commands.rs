use tauri::{command, AppHandle, Runtime};

use crate::{BgLocationExt, Result, StartTrackingArgs};

#[command]
pub(crate) async fn start_tracking<R: Runtime>(
    app: AppHandle<R>,
    args: StartTrackingArgs,
) -> Result<()> {
    app.bg_location().start_tracking(args)
}

#[command]
pub(crate) async fn stop_tracking<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.bg_location().stop_tracking()
}
