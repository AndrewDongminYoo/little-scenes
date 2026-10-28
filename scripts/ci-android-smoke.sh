#!/usr/bin/env bash
set -euo pipefail
mkdir -p evidence
capture_failure() {
	result=$?
	if [[ ${result} -ne 0 ]]; then
		adb logcat -d -v threadtime >evidence/android-logcat.txt 2>&1 || true
		adb shell dumpsys activity activities >evidence/android-activities.txt 2>&1 || true
		adb shell pidof kr.donminzzi.littlescenes >evidence/android-pid.txt 2>&1 || true
	fi
	exit "${result}"
}
trap capture_failure EXIT
adb install android/app/build/outputs/apk/release/app-release.apk
maestro test --format junit --output evidence/android.xml .maestro/smoke.yaml
adb root
adb pull /data/data/kr.donminzzi.littlescenes/cache/little-scenes evidence/android-png
python3 scripts/verify-png.py evidence/android-png
