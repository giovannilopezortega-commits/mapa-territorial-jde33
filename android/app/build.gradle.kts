plugins {
    id("com.android.application")
}

android {
    namespace = "com.giovannilopez.mapaterritorialjde33"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.giovannilopez.mapaterritorialjde33"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}
