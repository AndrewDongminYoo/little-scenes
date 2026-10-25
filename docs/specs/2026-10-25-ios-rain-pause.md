# iOS rain pause regression

## Problem

Run 40170264543 built the iOS application but failed the rain smoke assertion after tapping `일시정지`.
The screenshot and accessibility hierarchy still showed playback running.
The native driver recorded one tap inside the button bounds.
Its screenshot-comparison log did not represent a second tap.
The unchanged main application passed run 40171724354.
Diagnostic run 40174699179 also passed and recorded one pause press followed by `playing = false` about 11 milliseconds later.
These passing runs establish intermittence, not a correction.

## Scope

Identify whether the press reaches React Native and whether playback changes afterward.
Fix the observed cause with the smallest change and retain the existing pause assertion.
Use temporary press and playback traces for the diagnostic candidate, then remove them from the final implementation.

## Acceptance

- Capture native evidence that distinguishes missing input from an incorrect state transition.
- Exercise ten consecutive pause/resume cycles with every transition asserted.
- Require playback to start when needed, pause on one tap, and expose `재생` afterward.
- Preserve Reduced Motion behavior and the existing rendering and sharing assertions.
- Pass lint, typecheck, the test suite, and both native CI jobs on the final candidate.

## Constraints

No dependency changes, unconditional retries, longer presses, or assertion removal as a substitute for diagnosis.
Preserve the compiled simulator application during diagnosis so further native inspection can reuse the same binary.
No product visual redesign or merge is authorized by this follow-up PR request.
Oracle retrieval returned `[TOOL_FAILED]` because the worker could not verify the indexed project ID.
The repository's `docs/render-responsiveness.md` records the prior Reduced Motion normalization and requires retaining the pause transition assertion.
