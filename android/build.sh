#!/bin/bash
# Build the Logn APK.
#   ANDROID_SDK   path to the Android SDK (needs build-tools 34.0.0 and platforms/android-34)
#   KEYSTORE      your own signing keystore (make one: keytool -genkeypair -keystore logn.keystore -alias logn -keyalg RSA -validity 10000)
#   KS_PASS       its password
#   LOGN_SERVER   optional: https://your.server/<token>  — leave empty for a phone-only app (no Chat sync)
# Output: ./Logn.apk
set -e
cd "$(dirname "$0")"
: "${ANDROID_SDK:?set ANDROID_SDK}"; : "${KEYSTORE:?set KEYSTORE}"; : "${KS_PASS:?set KS_PASS}"
B=$ANDROID_SDK/build-tools/34.0.0; J=$ANDROID_SDK/platforms/android-34/android.jar; W=../app
rm -rf out assets && mkdir -p out/c out/gen/com/ke/logn out/dex assets/www
cp $W/index.html assets/www/ && cp -r $W/css $W/js $W/fonts assets/www/
printf 'package com.ke.logn;\nclass Secret { static final String SERVER = "%s"; }\n' "${LOGN_SERVER%/}" > out/gen/com/ke/logn/Secret.java
$B/aapt2 compile --dir res -o out/res.zip
$B/aapt2 link -o out/base.apk -I $J --manifest AndroidManifest.xml --java out/gen -A assets out/res.zip
javac -encoding UTF-8 -nowarn -source 8 -target 8 -bootclasspath $J -classpath $J -d out/c $(find src out/gen -name "*.java")
$B/d8 --lib $J --min-api 24 --output out/dex $(find out/c -name "*.class")
python3 -c "import zipfile;z=zipfile.ZipFile('out/base.apk','a');z.write('out/dex/classes.dex','classes.dex');z.close()"
$B/zipalign -f 4 out/base.apk out/a.apk
$B/apksigner sign --ks "$KEYSTORE" --ks-pass pass:"$KS_PASS" --v4-signing-enabled false --out Logn.apk out/a.apk
rm -rf out assets
ls -la Logn.apk
