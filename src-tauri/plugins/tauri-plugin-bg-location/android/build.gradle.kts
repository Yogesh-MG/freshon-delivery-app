plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.freshon.delivery.bglocation"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            // Propagate our keep rules to the consuming app, whose release build
            // DOES minify — the plugin + service classes are loaded reflectively
            // and would otherwise be stripped/renamed.
            consumerProguardFiles("proguard-rules.pro")
        }
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    // Tauri Android runtime — provides app.tauri.plugin.Plugin and the annotations.
    // The Tauri gradle setup exposes it to plugin subprojects as :tauri-android.
    implementation(project(":tauri-android"))
    // HttpURLConnection cannot issue PATCH; OkHttp can, and it's the standard
    // Android HTTP client.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
