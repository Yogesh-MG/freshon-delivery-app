package com.freshon.delivery.bglocation

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.max

/**
 * Runs while a delivery is active and PATCHes the rider's location to the
 * backend. Because it is a foreground service it keeps running when the app is
 * backgrounded or the screen is off — which is the whole point, since the
 * webview (and therefore the JS WebSocket heartbeat) is frozen then.
 *
 * Uses [LocationManager] rather than fused location so there is no Google Play
 * Services dependency: it works on every device, GMS or not.
 *
 * Auth: it reuses the access token handed in at start. It deliberately does NOT
 * refresh — deliveries are short enough to outlive a token, and an independent
 * refresh here would race the JS layer's rotating refresh token. On a 401 it
 * simply skips that cycle; the JS heartbeat resumes (with a fresh token) the
 * moment the app is foregrounded again.
 */
class LocationForegroundService : Service(), LocationListener {

    companion object {
        const val ACTION_START = "com.freshon.delivery.bglocation.START"
        const val EXTRA_BASE_URL = "baseUrl"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_INTERVAL = "intervalMs"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"

        private const val TAG = "BgLocation"
        private const val CHANNEL_ID = "freshon_delivery_tracking"
        private const val NOTIF_ID = 4711
        private const val MIN_DISTANCE_M = 10f
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }

    private val http = OkHttpClient.Builder()
        .callTimeout(15, TimeUnit.SECONDS)
        .build()
    private val io = Executors.newSingleThreadExecutor()

    private var locationManager: LocationManager? = null
    private var baseUrl: String = ""
    private var token: String = ""
    private var intervalMs: Long = 30_000
    private var lastSentAt: Long = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.getStringExtra(EXTRA_BASE_URL)?.let { baseUrl = it.trimEnd('/') }
        intent?.getStringExtra(EXTRA_TOKEN)?.let { token = it }
        intervalMs = intent?.getLongExtra(EXTRA_INTERVAL, intervalMs) ?: intervalMs
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Delivery in progress"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: "Sharing your location"

        startInForeground(title, body)
        startLocationUpdates()
        // Re-deliver the last intent if the OS kills and restarts us, so the
        // service comes back with its base URL / token intact.
        return START_REDELIVER_INTENT
    }

    private fun startInForeground(title: String, body: String) {
        createChannel()
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Delivery tracking",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Shown while you are on an active delivery"
                setShowBadge(false)
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun startLocationUpdates() {
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        locationManager = lm

        val hasFine = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
            Log.w(TAG, "Location permission not granted; stopping service")
            stopSelf()
            return
        }

        val provider = when {
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> {
                Log.w(TAG, "No location provider enabled")
                return
            }
        }
        try {
            lm.requestLocationUpdates(
                provider,
                max(intervalMs, 5_000L),
                MIN_DISTANCE_M,
                this,
                Looper.getMainLooper(),
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "requestLocationUpdates denied", e)
            stopSelf()
        }
    }

    override fun onLocationChanged(location: Location) {
        val now = System.currentTimeMillis()
        // LocationManager can fire faster than our interval; throttle to it.
        if (now - lastSentAt < intervalMs - 1_000) return
        lastSentAt = now
        postLocation(location.latitude, location.longitude)
    }

    private fun postLocation(lat: Double, lng: Double) {
        if (baseUrl.isEmpty() || token.isEmpty()) return
        io.execute {
            try {
                val payload = """{"online":true,"latitude":$lat,"longitude":$lng}"""
                val request = Request.Builder()
                    .url("$baseUrl/api/delivery-partner/status/")
                    .patch(payload.toRequestBody(JSON))
                    .header("Authorization", "Bearer $token")
                    .header("X-App-Platform", "DeliveryApp")
                    .build()
                http.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        Log.w(TAG, "status update failed: HTTP ${response.code}")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "status update error: ${e.message}")
            }
        }
    }

    // LocationListener no-ops (required overrides on older API levels).
    @Deprecated("Deprecated in API 29")
    override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    override fun onDestroy() {
        try {
            locationManager?.removeUpdates(this)
        } catch (_: Exception) {
        }
        io.shutdown()
        super.onDestroy()
    }
}
