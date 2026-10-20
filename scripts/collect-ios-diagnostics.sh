#!/usr/bin/env bash
# Best-effort diagnostics only. The preceding test retains its failing exit code.
set -uo pipefail
mkdir -p evidence/ios-diagnostics
OUT="$PWD/evidence/ios-diagnostics"
xcodebuild -version > "$OUT/xcode.txt" 2>&1
xcrun simctl list --json > "$OUT/simulators.json" 2>&1
ps -axo pid,ppid,etime,command | grep -E 'xcodebuild|Simulator|testmanager|maestro' > "$OUT/processes.txt" || true
PREDICATE='process CONTAINS[c] "testmanager" OR process CONTAINS[c] "xctest" OR process CONTAINS[c] "maestro" OR process == "CoreSimulatorService" OR process == "LittleScenes"'
/usr/bin/log show --last 10m --style compact --predicate "$PREDICATE" > "$OUT/host.log" 2>&1 || true
if [[ -n "${IOS_SIMULATOR_UDID:-}" ]]; then
  xcrun simctl spawn "$IOS_SIMULATOR_UDID" log show --last 10m --style compact --predicate "$PREDICATE" > "$OUT/simulator.log" 2>&1 || true
  xcrun simctl io "$IOS_SIMULATOR_UDID" screenshot "$OUT/simulator.png" || true
fi
# Maestro writes xcodebuild results under its own temporary derived-data directory.
# Copy only its test result bundles, not arbitrary host files or credentials.
while IFS= read -r -d '' RESULT; do
  NAME="$(basename "$(dirname "$(dirname "$(dirname "$RESULT")")")")-$(basename "$RESULT")"
  cp -R "$RESULT" "$OUT/$NAME" || true
done < <(find "${TMPDIR:-/tmp}" -path '*maestro_xctestrunner_xcodebuild_output*/Logs/Test/*.xcresult' -type d -prune -print0 2>/dev/null)
exit 0
