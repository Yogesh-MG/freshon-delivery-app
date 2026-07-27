# FCM Integration Guide — Freshon Delivery (rider app)

How to add Firebase Cloud Messaging so a rider is woken for a **new trip offer**
even when the app is backgrounded or killed. This app has **no FCM today** — this
is a from-scratch build. It mirrors the in-tree `tauri-plugin-bg-location` plugin
conventions exactly.

> Package name is **`com.freshon.delivery`** (see `tauri.conf.json`). Everything
> below uses that identifier.

---

## 0. What you're building & why

Current offer path: WebSocket (`src/lib/deliverySocket.ts`) → only works while the
app is foregrounded. FCM fills the one gap: **push that survives app-kill / reboot**,
delivered by Google Play Services (not your process).

```
Trip offer created (Django)
  ├─ Redis publish → Rust WS service → riders with app OPEN        (already exists)
  └─ FCM send      → Google FCM → Play Services → riders with app CLOSED  (this doc)
```

Four layers, in dependency order:
1. **Firebase project** — console setup + `google-services.json`.
2. **Android/Gradle** — google-services plugin + firebase-messaging dep.
3. **`tauri-plugin-fcm`** — native token + message bridge to JS.
4. **JS glue** — register token with backend, handle incoming messages.
5. **Backend** (separate `Freshon-Cloud-Deploy` repo) — store token, send on offer.

---

## 1. Firebase project (one-time, console)

1. https://console.firebase.google.com → **Add project**.
2. **Add app → Android**. Package name: `com.freshon.delivery`. (No SHA-1 needed for FCM.)
3. Download **`google-services.json`** → place at:
   `src-tauri/gen/android/app/google-services.json`
4. Project Settings → **Service accounts → Generate new private key** →
   `firebase-credentials.json` (this goes to the **backend**, never the app).

**Gitignore the secrets** (add to `.gitignore`):
```
src-tauri/gen/android/app/google-services.json
**/firebase-credentials.json
```

---

## 2. Android / Gradle wiring

> ⚠️ `src-tauri/gen/android/` is **generated** but committed in this repo, so edits
> persist through normal builds. They are only lost if someone re-runs
> `tauri android init`. Commit these changes, and keep the firebase-messaging
> dependency inside the *plugin* module (step 3) so it survives regeneration; only
> the google-services **plugin application** must live in `gen/android`.

**`src-tauri/gen/android/build.gradle.kts`** (project-level `plugins {}` block) — add:
```kotlin
plugins {
    // ...existing...
    id("com.google.gms.google-services") version "4.4.2" apply false
}
```

**`src-tauri/gen/android/app/build.gradle.kts`** (`plugins {}` at top) — add:
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
    id("com.google.gms.google-services")   // <-- add; reads app/google-services.json
}
```

The `firebase-messaging` dependency itself is declared in the plugin module (step 3.9),
so it travels with the plugin.

---

## 3. The `tauri-plugin-fcm` crate

Create `src-tauri/plugins/tauri-plugin-fcm/` mirroring `tauri-plugin-bg-location/`.
File-by-file below.

### 3.1 `Cargo.toml`
```toml
[package]
name = "tauri-plugin-fcm"
version = "0.1.0"
description = "Firebase Cloud Messaging token + message bridge for the FreshOn delivery rider app (Android)."
edition = "2021"
rust-version = "1.77.2"
links = "tauri-plugin-fcm"

[dependencies]
tauri = { version = "2" }
serde = { version = "1", features = ["derive"] }
thiserror = "1"
log = "0.4"

[build-dependencies]
tauri-plugin = { version = "2", features = ["build"] }
```

### 3.2 `build.rs`
```rust
const COMMANDS: &[&str] = &["get_token"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
```

### 3.3 `src/error.rs` — copy verbatim from bg-location's `error.rs`.

### 3.4 `src/models.rs`
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    pub token: Option<String>,
}
```

### 3.5 `src/commands.rs`
```rust
use tauri::{command, AppHandle, Runtime};
use crate::{FcmExt, Result, TokenResponse};

#[command]
pub(crate) async fn get_token<R: Runtime>(app: AppHandle<R>) -> Result<TokenResponse> {
    app.fcm().get_token()
}
```

### 3.6 `src/lib.rs`
```rust
//! Firebase Cloud Messaging bridge (Android only). Fetches the device FCM token
//! and forwards incoming messages to JS via the "message" / "token-refresh"
//! plugin events. Desktop builds get no-op commands.

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
use desktop::Fcm;
#[cfg(mobile)]
use mobile::Fcm;

pub trait FcmExt<R: Runtime> {
    fn fcm(&self) -> &Fcm<R>;
}

impl<R: Runtime, T: Manager<R>> FcmExt<R> for T {
    fn fcm(&self) -> &Fcm<R> {
        self.state::<Fcm<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("fcm")
        .invoke_handler(tauri::generate_handler![commands::get_token])
        .setup(|app, api| {
            #[cfg(mobile)]
            let fcm = mobile::init(app, api)?;
            #[cfg(desktop)]
            let fcm = desktop::init(app, api)?;
            app.manage(fcm);
            Ok(())
        })
        .build()
}
```

### 3.7 `src/mobile.rs`
```rust
use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;
use crate::Result;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.freshon.delivery.fcm";

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    #[allow(unused_variables)] api: PluginApi<R, C>,
) -> Result<Fcm<R>> {
    #[cfg(target_os = "android")]
    {
        let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "FcmPlugin")?;
        return Ok(Fcm(Some(handle)));
    }
    #[cfg(not(target_os = "android"))]
    Ok(Fcm(None))
}

pub struct Fcm<R: Runtime>(Option<PluginHandle<R>>);

impl<R: Runtime> Fcm<R> {
    pub fn get_token(&self) -> Result<TokenResponse> {
        match &self.0 {
            Some(handle) => handle
                .run_mobile_plugin::<TokenResponse>("getToken", ())
                .map_err(Into::into),
            None => Ok(TokenResponse::default()),
        }
    }
}
```

### 3.8 `src/desktop.rs`
```rust
use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;
use crate::Result;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<Fcm<R>> {
    Ok(Fcm(app.clone()))
}

pub struct Fcm<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> Fcm<R> {
    pub fn get_token(&self) -> Result<TokenResponse> {
        log::info!("[fcm] get_token is a no-op on desktop");
        Ok(TokenResponse::default())
    }
}
```

### 3.9 `permissions/default.toml`
```toml
"$schema" = "schemas/schema.json"

[default]
description = "Allows the rider app to fetch the FCM token and receive message events."
permissions = ["allow-get-token"]
```

### 3.10 `proguard-rules.pro` (R8 keep rules — the OS instantiates the service reflectively)
```
-keep class com.freshon.delivery.fcm.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
```

### 3.11 `android/build.gradle.kts`
```kotlin
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.freshon.delivery.fcm"
    compileSdk = 36
    defaultConfig { minSdk = 24 }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            consumerProguardFiles("proguard-rules.pro")
        }
    }
    kotlinOptions { jvmTarget = "1.8" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation(project(":tauri-android"))
    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging")
}
```

### 3.12 `android/src/main/AndroidManifest.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <application>
        <service
            android:name=".FreshonMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

### 3.13 `android/src/main/java/com/freshon/delivery/fcm/FcmPlugin.kt`
```kotlin
package com.freshon.delivery.fcm

import android.app.Activity
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.firebase.messaging.FirebaseMessaging

@TauriPlugin
class FcmPlugin(private val activity: Activity) : Plugin(activity) {

    override fun load(webView: WebView) {
        super.load(webView)
        // Expose this plugin instance to the messaging service so it can forward
        // messages to JS while the app is alive.
        instance = this
    }

    @Command
    fun getToken(invoke: Invoke) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                invoke.resolve(JSObject().put("token", task.result))
            } else {
                invoke.reject(task.exception?.message ?: "token fetch failed")
            }
        }
    }

    /** Called by the messaging service (see below) to push a message to JS. */
    fun emitMessage(data: JSObject) = trigger("message", data)
    fun emitTokenRefresh(token: String) =
        trigger("token-refresh", JSObject().put("token", token))

    companion object {
        // Set in load(); the FirebaseMessagingService reads it. Null when the app
        // process isn't alive — in that case the service posts a notification.
        @JvmStatic var instance: FcmPlugin? = null
    }
}
```

### 3.14 `android/src/main/java/com/freshon/delivery/fcm/FreshonMessagingService.kt`
```kotlin
package com.freshon.delivery.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import app.tauri.plugin.JSObject
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Instantiated by the OS (not by Tauri) whenever FCM delivers a message or the
 * token rotates — including when the app is killed. If the app process is alive,
 * forward to JS via the plugin instance; otherwise post a notification directly.
 */
class FreshonMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        FcmPlugin.instance?.emitTokenRefresh(token)
        // If the app is dead the JS layer will re-fetch and re-register on next launch.
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val plugin = FcmPlugin.instance
        val data = JSObject()
        message.data.forEach { (k, v) -> data.put(k, v) }

        if (plugin != null) {
            // App is alive — let JS decide (play sound, route into offer flow).
            plugin.emitMessage(data)
        } else {
            // App is backgrounded/killed — show a notification so the rider sees it.
            val title = message.notification?.title ?: message.data["title"] ?: "New trip available"
            val body = message.notification?.body ?: message.data["body"] ?: "Open FreshOn to accept"
            showNotification(title, body)
        }
    }

    private fun showNotification(title: String, body: String) {
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "freshon_offers"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mgr.createNotificationChannel(
                NotificationChannel(channelId, "Trip offers", NotificationManager.IMPORTANCE_HIGH)
            )
        }
        val notif = NotificationCompat.Builder(this, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // replace with app icon
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        mgr.notify(2001, notif)
    }
}
```

> The `load()` override signature must match your bundled `app.tauri.plugin.Plugin`.
> Verify against `plugins/tauri-plugin-bg-location/android/.tauri/tauri-api/.../Plugin.kt`.

---

## 4. Register the plugin in the app

**`src-tauri/Cargo.toml`** — add under the bg-location line:
```toml
tauri-plugin-fcm = { path = "plugins/tauri-plugin-fcm" }
```

**`src-tauri/src/lib.rs`** — add after the bg-location plugin:
```rust
.plugin(tauri_plugin_fcm::init())
```

**`src-tauri/capabilities/default.json`** — add to `permissions`:
```json
"fcm:default"
```

---

## 5. JS glue

### 5.1 `src/lib/fcm.ts`
```ts
import { invoke } from "@tauri-apps/api/core";
import { addPluginListener, type PluginListener } from "@tauri-apps/api/core";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Current device FCM token, or null off-Android / on failure. */
export async function getFcmToken(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const res = await invoke<{ token: string | null }>("plugin:fcm|get_token");
    return res.token ?? null;
  } catch (err) {
    console.warn("[fcm] getToken failed:", err);
    return null;
  }
}

/** Fires for every incoming data message while the app is alive. */
export async function onFcmMessage(
  cb: (data: Record<string, string>) => void,
): Promise<PluginListener | null> {
  if (!isTauri()) return null;
  return addPluginListener("fcm", "message", cb as (p: unknown) => void);
}

export async function onFcmTokenRefresh(
  cb: (token: string) => void,
): Promise<PluginListener | null> {
  if (!isTauri()) return null;
  return addPluginListener("fcm", "token-refresh", (p: { token: string }) => cb(p.token));
}
```

### 5.2 Register the token with the backend
Add to `src/lib/deliveryPartnerService.ts`:
```ts
static async registerFcmToken(token: string) {
  return apiClient.patch("/api/delivery-partner/fcm-token/", {
    fcm_token: token,
    push_notifications_enabled: true,
  });
}
```

### 5.3 Wire it up (e.g. in `Index.tsx` or a small hook)
- On login / first mount **and** on going online: `getFcmToken()` → `registerFcmToken(token)`.
- Subscribe once: `onFcmTokenRefresh(t => registerFcmToken(t))`.
- Subscribe: `onFcmMessage(data => { play("offer"); toast(...); refreshDashboard(); })`
  — reuse the existing offer sound/flow. Foreground messages come here; background
  ones are shown by the native service.
- On logout: `DeliveryPartnerService.clearFcmToken()` (a DELETE/empty PATCH) so a
  logged-out phone stops receiving offers.

Ask for notification permission first — you already have `requestNotificationPermission()`
in `src/lib/permissions.ts`; call it before registering the token.

---

## 6. Backend (`Freshon-Cloud-Deploy`, separate repo)

Mirror the Picker app's FCM setup:
1. **Model**: add `fcm_token` (CharField, nullable) + `push_notifications_enabled`
   (Boolean) to the delivery-partner profile; migrate.
2. **Endpoint**: `PATCH /api/delivery-partner/fcm-token/` to save the token for the
   authenticated rider.
3. **Admin SDK**: install `firebase-admin`; load `firebase-credentials.json` via
   `FIREBASE_CREDENTIALS_PATH` or base64 `FIREBASE_CREDENTIALS_JSON`.
4. **Send on offer**: in the trip-offer signal/dispatch, alongside the existing
   Redis publish, call `messaging.send(...)` to the rider's `fcm_token`. Use a
   **data message** (so the app controls behavior) with `title`/`body` keys, or a
   combined notification+data payload.
5. **Prune invalid tokens**: on `UNREGISTERED` / `INVALID_ARGUMENT` responses,
   null out that `fcm_token`.

---

## 7. Build & test

```bash
# google-services.json must be in place first
npx tauri android build --debug   # debug keeps R8 off; fastest to iterate
```

1. Launch, log in → check logcat for the token; confirm the backend row has it.
2. **Foreground test**: send from Firebase Console → Cloud Messaging → target
   `com.freshon.delivery`. App open → `onFcmMessage` fires (sound + toast).
3. **Background test**: swipe the app away, send again → notification appears in
   the tray (posted by `FreshonMessagingService`).
4. **Killed/reboot test**: force-stop, reboot, send → still delivered (this is the
   whole point).
5. Then wire a **real trip offer** through the backend send path and repeat.

---

## 8. Gotchas

- **`gen/android` is generated.** Commit the google-services edits; re-running
  `tauri android init` wipes them. The firebase-messaging dep lives in the plugin,
  so only the google-services *plugin application* is at risk.
- **R8 in release.** The `consumerProguardFiles` keep rules (3.10) are mandatory —
  without them R8 strips the reflectively-loaded service and messages silently stop
  in release builds (works fine in `--debug`). Test a **signed release APK** once.
- **Data vs notification messages.** A pure `notification` payload is auto-displayed
  by Play Services when backgrounded and your `onMessageReceived` won't run in the
  background. For full control (offer sound, dedup, routing) send **data-only** and
  build the notification yourself, as the service above does.
- **Play Services required.** FCM needs Google Play Services on the device — fine for
  normal phones, absent on some AOSP/emulator images. Use a Play-enabled emulator.
- **Token lifecycle.** Tokens rotate; always handle `onNewToken`/`token-refresh` and
  re-register. Register on login AND on going online (idempotent PATCH).
- **No FCM for live location.** Active-trip tracking is still the bg-location
  foreground service — FCM is only for waking a closed app for offers/alerts.
- **iOS.** This plugin is Android-only (`Fcm(None)` elsewhere). iOS FCM needs APNs +
  a separate native path; out of scope until you ship iOS.
```
