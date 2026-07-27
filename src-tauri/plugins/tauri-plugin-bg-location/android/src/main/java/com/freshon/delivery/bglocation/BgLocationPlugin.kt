package com.freshon.delivery.bglocation

import android.app.Activity
import android.content.Intent
import android.os.Build
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class StartArgs {
    lateinit var baseUrl: String
    lateinit var token: String
    var intervalMs: Long = 30_000
    var notificationTitle: String = "Delivery in progress"
    var notificationBody: String = "FreshOn is sharing your location for this trip"
}

/**
 * Thin JS -> native bridge. All it does is start/stop [LocationForegroundService];
 * the service owns the location loop and the network calls. Invoked from the
 * frontend as `plugin:bg-location|start_tracking` / `|stop_tracking`.
 */
@TauriPlugin
class BgLocationPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun startTracking(invoke: Invoke) {
        val args = invoke.parseArgs(StartArgs::class.java)
        val intent = Intent(activity, LocationForegroundService::class.java).apply {
            action = LocationForegroundService.ACTION_START
            putExtra(LocationForegroundService.EXTRA_BASE_URL, args.baseUrl)
            putExtra(LocationForegroundService.EXTRA_TOKEN, args.token)
            putExtra(LocationForegroundService.EXTRA_INTERVAL, args.intervalMs)
            putExtra(LocationForegroundService.EXTRA_TITLE, args.notificationTitle)
            putExtra(LocationForegroundService.EXTRA_BODY, args.notificationBody)
        }
        // Started from the webview activity, which is in the foreground when the
        // rider taps Accept, so the Android 12+ background-start restriction on
        // foreground services does not apply.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            activity.startForegroundService(intent)
        } else {
            activity.startService(intent)
        }
        invoke.resolve()
    }

    @Command
    fun stopTracking(invoke: Invoke) {
        activity.stopService(Intent(activity, LocationForegroundService::class.java))
        invoke.resolve()
    }
}
