# CI validation contract

## Goal

Keep this learning repository useful with repeatable, inexpensive checks.
The operator accepted PR #9 despite the unrelated Android scene visibility failure in run `40183456700` and requested a replacement for inconsistent native CI.
Native build caching is deferred.

## Automatic checks

One Linux `quality` job runs on pull requests and main pushes:

| Check                                 | What it reads                                                                                                            | Limits                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Typecheck and lint                    | Application and test source                                                                                              | No runtime execution                                                     |
| Node tests                            | Input validation, settings recovery, clocks, geometry, scene algorithms, write ordering, stale results, and share gating | No native event delivery or route interaction                            |
| Worklet regression                    | Actual installed production OXC transform of rendering modules                                                           | No native Worklet runtime                                                |
| CanvasKit renders with `RENDER_ALL=1` | Shared artwork and resource code, Korean fonts, every declared render variant, pixel differences, and letterbox bounds   | No gallery controls, native GPU, or full-screen UI screenshot comparison |
| Offline scanner adapter tests         | Filesystem JSONL parsing, decoded findings, source locations and failure handling                                        | No live credential verification                                          |
| Expo dependency checks                | Installed dependency and configuration compatibility                                                                     | No native compilation                                                    |
| Expo export for all platforms         | iOS, Android, and web JavaScript bundles                                                                                 | No installable native binary                                             |

Render evidence remains downloadable as `skia-render-evidence` for three days.
Generating PNGs alone does not establish visual equivalence: current assertions inspect output dimensions, encoding, resource properties, and specific pixel changes rather than a complete golden-image comparison.
No native build, emulator/simulator boot, or Maestro driver runs in automatic CI.

## Local native acceptance

Retain `.maestro/smoke.yaml` and `.maestro/rain-playback.yaml` for deliberate local checks against an installed development or release build.
Run device checks when changing native dependencies, Worklet boundaries, gesture handling, routing, or OS sharing.
Check gallery entry to all three scenes, editing, pause/resume, appreciation mode, and PNG sharing.
Use the existing [device checklist](verification.md#재현-체크리스트) for IME, accessibility, and device behavior.
Local development and release behavior remain the product acceptance target.
A CI-only assertion failure needs evidence of an application defect before it warrants more native infrastructure work.

## Scope

This transition adds no dependencies and changes no application behavior.
It reuses the existing tests and expands the existing renderer to its already implemented full variant set.
Route/component interaction tests remain a coverage gap; introducing a component harness is a separate bounded task if changes in that area justify it.
