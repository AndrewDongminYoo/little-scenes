# Coin scratch card

A third, offline scene using the same 360×640 artwork and 1080×1920 PNG pipeline.

- Input phrase is concealed under a baked metallic coating. The artwork is original; reference photos are not bundled.
- Coin contact is an oriented ellipse (radii 17 and 2.2 logical pixels). Swiping along its edge makes a thin cut; perpendicular motion scrapes broadly. Angle cycles through 45°, 90°, 0° without resetting damage.
- A bounded 135×72 wear grid accumulates abrasion. Three residual coating levels plus seeded grain leave ragged edges; repeated passes remove remaining foil. This is a visual material approximation, not pressure sensing or a physical solver.
- Up to 96 clustered foil fragments pause at the scrape, then tumble/fall and settle. Only newly exposed material emits debris. No unbounded path or particle history. Static grain/typography bake on the existing render runtime, masks update only on contact, animation stops after settling/offscreen. Reduced Motion settles debris immediately.
- Phrase/angle persist, scratch progress is session-local. Changing text resets the foil. Rotation and immersion do not reset it. Reset covers it; accessible “모두 열기” provides a non-drag alternative. PNG captures frozen wear and debris, not the finger coin/UI.
- No purchase, prize, random payout or real gambling logic.

## Verification

Local typecheck, lint and 36 tests pass, including directional area, cumulative/deterministic wear, bounds, finite input, no repeated debris from bare cells, and OXC closure order. Real Skia renders untouched/partial/open states. Pixel regression verifies the intact coating actually hides the phrase and full reveal changes only the foil panel. Existing embroidery/rain render regressions remain.

Maestro now visits all three scenes, performs a scratch gesture, checks nonzero progress, shares the partial state, opens all, resets and checks 0%. Both platforms must export at least three 1080×1920 PNGs. Native CI results are pending until the PR run completes. Headless Linux drawing does not establish native frame rate or physical-device performance.

First native run 39366151774: quality passed; Android built and rendered a real scratch, but its first-use OS immersive-education overlay intercepted the exit tap. The previous negative 0% assertion could pass with all app controls obscured. The smoke now acknowledges the Android system overlay and requires visible share controls plus a positive nonzero progress value. This is a test harness correction, not a disabled assertion. Updated native verification is pending.

The iOS smoke flow waits for the system share sheet’s `Copy` action after each share tap before taking its share-sheet screenshot and stopping the app.
PNG writing precedes share-sheet presentation in `sharePng`, so this wait prevents app termination during export.
Run 39800329936 attempt 2 passed the iOS smoke commands but produced only embroidery and scratch PNGs; the rain screenshot still showed `준비 중` immediately before app termination.
The existing three-PNG verification remains required, and the corrected native run is pending.

## Optional debris and typography

`debrisMode` defaults to `fall` for existing installs. `stay` keeps chips at the scrape edge, with no gravity, inertia, or time-based rotation. Only a swept coin contact pushes existing chips, including on already bare paper. Switching modes rebases existing fragments at their current rendered position; it does not reset wear. The 96-fragment cap remains a visual approximation, not conservation of material.

`scratchFont` selects bundled Gaegu (`handwritten`, default) or Noto Sans KR (`sans`) for the hidden user phrase only. Both OFL license notices remain bundled; no new font download. The resource cache includes font choice, but font changes do not reset scratch progress. Both settings persist; progress remains session-local. Native smoke covers resident mode, changing the font after scratching, and persistence after restarting.
