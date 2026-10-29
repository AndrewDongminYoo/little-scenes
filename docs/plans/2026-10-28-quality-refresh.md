# Quality Tooling Refresh Plan

## Work

1. Verify repository identity, instructions, current changes and Oracle precedent.
2. Refresh compatible dependency and linter versions with existing package managers.
3. Run the declared local gates and `trunk check --all --no-fix`.
4. Reconcile affected knowledge and review the scoped candidate.
5. Commit locally and prepare visible evidence before requesting publication approval.

## Declared Gates

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx expo install --check`
- `npx expo-doctor`
- `npm run render:check (owned external output)`
- `npx expo export --platform all (owned external output)`
- `trunk check --all --no-fix`

## Boundaries and Verification

Use Expo SDK 58's installer and compatibility checks for native package versions.
The official SDK reference targets React Native 0.88 and React 19.3.0: <https://docs.expo.dev/versions/v58.0.0/>.
Do not select unrelated latest native majors independently.
Keep TypeScript below 6.1 for the actual ESLint parser peer range.
Refresh the existing Zod override only within its declared compatible line when registry and advisory evidence support a change.
Preserve source, tests, fonts, preview assets, app identifiers and device state.
Run the headless CanvasKit renderer on an explicit copied verification input set because the script always writes `assets/previews`, even with `RENDER_OUT` set.
Write exports to a task-owned output directory.
The rendered controls and JavaScript exports do not establish native GPU, gesture, OS sharing or physical-device behavior.
Inspect the current native acceptance contract before treating a dependency-changing candidate as ready.

## Oracle

The personal Oracle returned global Trunk precedents from `wiki/concepts/trunk-quality-gate-agent.md` and `.claude/agents/trunk-quality-gate.md` at source commit `9670d54de3076c5239713f54900c7a855bd18478`.
They confirm authorized no-fix full scans, exact Pinact checks and hook-failure diagnosis without bypasses.
The returned window was partial and source freshness was unverified.
No project-specific test precedent was returned; current repository scripts and CI determine the local checks.

## Supported Candidate and Completed Local Acceptance

The online Expo compatibility service requires React Native `0.88.0` and rejects `0.88.1`, despite the installed SDK bundle listing `0.88.1`.
Use the installer's selected version and retain the failed patch attempt as evidence of the hold.
The inherited node-forge exception is obsolete because installed `1.4.2` is outside the advisory's affected `<=1.4.0` range, even though its first-patched field is null.
Remove that exception and retain only the specifically justified no-patch deepmerge exception.
Keep npm audit's seven propagated low records visible.
The first full Trunk run overlapped dependency installation and reported discarded manifest targets, so it is diagnostic only and cannot serve as the final scan.
The final uncached scan passed after the dependency graph was stable.
The approved disposable iOS 27.0 simulator passed gallery, scene, pause/resume and share-sheet checks after an unsigned Release build.
The owned simulator was deleted after the checks.
The final SDK-compatible graph passed all-platform JavaScript exports and preserved all 15 CanvasKit PNG outputs byte-for-byte.
The thirteen reader regressions, actual scanner controls and affected knowledge audit passed.
See the dated maintenance entry in `docs/verification.md` for native coverage and limits.
Publication still requires the operator's repository-specific approval.
