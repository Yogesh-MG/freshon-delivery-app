# The Tauri plugin + the service are instantiated reflectively (by class name),
# so R8 must not rename or remove them or their command methods.
-keep class com.freshon.delivery.bglocation.** { *; }

# OkHttp ships its own consumer rules, but keep these to silence R8 warnings on
# its optional Conscrypt/BouncyCastle code paths.
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
