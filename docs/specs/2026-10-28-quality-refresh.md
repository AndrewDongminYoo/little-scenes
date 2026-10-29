# Quality Tooling Refresh

## Approved Scope

Refresh supported dependencies and existing quality tooling.
Preserve public APIs, generated artifacts and repository-specific boundaries.

## Acceptance

- Pinact remains locked to `4.1.1` with `lint` and `upgrade`.
- The full no-fix Trunk scan and declared project gates pass.
- Changed manifests have package-manager-generated lockfiles under repository policy.
- Advisory dispositions have specific evidence and affected knowledge claims are reconciled.

## Publication

Push and PR creation require explicit repository-specific approval.
After approval, continue the requested hosted gates, merge, cleanup and memory recording.

## Scope Limits

Do not modify application behavior, renderer algorithms, shaders, fonts, artwork, app identifiers, generated native projects or device state.
Keep the existing Expo SDK major and use its compatible package combinations.
Keep committed previews unchanged during headless render checks.
Record native acceptance gaps explicitly instead of describing JavaScript exports as native builds.
