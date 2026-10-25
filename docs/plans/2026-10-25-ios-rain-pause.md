# iOS rain pause implementation plan

## Evidence and diagnosis

1. Preserve run 40170264543's failed assertion, screenshot, hierarchy, and native tap record.
2. Add temporary press-event traces in `src/ui/Button.tsx` and playback traces in `src/app/scene/[id].tsx`.
3. Collect iOS diagnostics on success and failure in `.github/workflows/ci.yml` so a passing reproduction still provides event evidence.
4. Run the unchanged Maestro smoke flow in a draft follow-up PR.
5. Since that flow passed, use `.maestro/rain-playback.yaml` to assert ten consecutive pause/resume cycles without retries.
6. Preserve the simulator app before the repeated test so the same compiled binary remains available if diagnosis needs another input backend.

The first diagnostic candidate used Info logs, which the default log readers can omit.
Temporary traces now use Error level, matching the retained native logs.
Run 40174699179 confirmed that the trace reader captures the press and resulting state transition.
No failing traced press has been captured yet.

Run 40178393579 passed the ten-cycle native regression and the original smoke flow.
Its native traces confirm ten actual pause and resume presses with alternating playback state.
The same binary passed twenty local accessibility-press cycles.
The local HID backend failed before delivery, and permission to install Maestro for equivalent local touch reproduction is pending.
Temporary application traces are now removed, and the final candidate must pass the native flows again without tracing overhead.
This removes diagnostic-only production code; it does not establish a fix for the original intermittent failure.

## Correction

1. Use the trace to select the smallest input, application-state, or test-driver correction.
2. Exercise the failing behavior before the fix and retain the native smoke assertion as the regression gate.
3. Remove temporary traces before marking the PR ready.
4. Update this plan and the affected verification record with the observed cause and final checks.

## Verification

Run `npm run typecheck`, `npm run lint`, and `npm test` locally.
Review the complete candidate diff and applicable documentation before each push.
Require the final PR head's quality, Android, and iOS checks to pass.
Keep the PR unassigned and in draft while diagnosis or a required check remains incomplete.
