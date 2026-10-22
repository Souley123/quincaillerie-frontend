# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- Capacitor : règles de conservation ---
# Les plugins natives sont chargés par réflexion depuis le WebView.
# Sans ces règles, R8/ProGuard renomme ou supprime les classes et
# l'appel JS échoue en release alors qu'il fonctionne en debug.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Conserve les infos de débogage des piles d'appel pour les rapports de crash.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
