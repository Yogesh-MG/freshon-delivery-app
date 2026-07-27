use serde::{Deserialize, Serialize};

/// Everything the native foreground service needs to start reporting location.
/// Serialized camelCase so it matches the JS payload and the Kotlin `@InvokeArg`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTrackingArgs {
    /// Backend origin, e.g. `https://api.freshon.in` (trailing slash tolerated).
    pub base_url: String,
    /// Bearer access token used to authenticate the location PATCH.
    pub token: String,
    /// Minimum ms between location POSTs. Defaults to 30_000 on the native side.
    pub interval_ms: Option<u64>,
    /// Persistent-notification title.
    pub notification_title: Option<String>,
    /// Persistent-notification body.
    pub notification_body: Option<String>,
}

/// The `{}` a Kotlin `invoke.resolve()` sends back; lets `run_mobile_plugin`
/// deserialize a response even though we don't use one.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmptyResponse {}
