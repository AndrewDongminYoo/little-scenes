# Little Scenes Implementation Plan

> Execution: 사용자의 명시적 요청에 따라 이 대화에서 직접 구현한다. 위임하지 않는다. 구현과 검증을 순서대로 직접 진행한다.

**Goal:** 두 작품에서 문구 입력 → 인터랙션 → 감상 → UI 없는 PNG 공유까지 연결한다.
**Architecture:** Expo Router 화면과 작품 렌더러를 분리한다. 하나의 명시적인 FrameState를 화면과 내보내기에서 공유하고, 텍스트 레이아웃·마스크와 정적 질감은 설정 변경 시에만 준비한다.
**Tech Stack:** Expo 안정 SDK, React Native, TypeScript strict, @shopify/react-native-skia, Reanimated/Worklets, Gesture Handler, Expo FileSystem/Sharing, AsyncStorage.
**Spec:** spec.md (사용자 첨부 원문 보존)

## 실행 환경과 범위

- 현재 직접 접근 가능한 작업 공간은 Linux이며 기존 앱 저장소/AGENTS.md는 발견되지 않았다. 새 프로젝트 디렉터리 little-scenes를 사용한다.
- 이 공간에는 xcodebuild와 adb가 없다. 소스 작성·타입·단위 테스트·번들·가능한 실제 Skia 렌더 검증을 구분하고, iOS/Android 네이티브 실행을 했다고 보고하지 않는다.
- 사용자의 Mac 조작에는 별도 실행 작업이 필요하므로, 위임 금지 상태에서 임의로 Mac 작업을 만들지 않는다.
- 사용자가 공개 저장소와 네이티브 CI 게시를 승인했다. 스토어 배포·유료 빌드·서명 설정은 포함하지 않는다.

## Global Constraints

- 최대 40 grapheme, 최대 3줄. 편집 중 IME 문자열은 보존하고 적용 시 검증한다.
- 한글·영문·숫자·공백·기본 문장부호만 허용한다. 공백 전용·미지원 문자·레이아웃 초과는 이유를 표시한다.
- 논리 좌표 360×640, 출력 1080×1920 PNG. 화면에서 비율을 보존하며 크롭하지 않는다.
- 자수 기본 문구 “오늘도, 천천히”; 비 기본 문구 “흐르는 대로”. 초기값은 최초 진입에만 쓴다.
- 자수 재생 1.6초 후 정지. 비 기본 방향은 아래→위. 비 강도는 세 단계로 제한한다.
- 자수 추가 설정은 실 색상 3개/밀도 2개, 비는 낮·밤/강도만 제공한다.
- 폰트·질감은 오프라인. 폰트 라이선스와 파일을 함께 보존한다.
- 로그인·서버·결제·MP4/GIF·범용 템플릿 엔진은 제외한다.
- 60fps는 목표이며 측정 전 달성으로 표기하지 않는다.

## Review Focus

1. 초기 저장소 로딩이 늦게 끝나도 새 편집값을 덮지 않는다 (Task 2).
2. 빠른 문구 변경 중 오래된 마스크가 새 결과를 대체하지 않는다 (Task 3).
3. 공유 중 백그라운드 이동/화면 이탈 시 모션이 잘못 재개되지 않는다 (Task 5).
4. 빈 문구 저장 후 재진입해도 기본 문구로 바꾸지 않는다 (Task 2).
5. 드래그 종료를 탭으로 오인하여 감상 모드가 해제되지 않는다 (Task 4).

## Task 1 — 호환 기반과 렌더링 수직 검증

**Files:** package.json, package-lock.json, app.config.ts, tsconfig.json, eslint.config.js, app/_layout.tsx, assets/fonts/*, src/render/probe.ts, tests/render-probe.test.ts.
**Interface:** renderProbe(text: string, width: number, height: number): Promise<Uint8Array>.

- [ ] Expo SDK 58 공식 안정 릴리스(2026-10-15)를 기준으로 npm 실제 패키지/Expo 권장 버전을 대조한다. 버전이 입수 불가능하면 조용히 다른 세대로 바꾸지 않고 차이를 보고한다.
- [ ] Expo가 지정한 설치 경로로 RN/Skia/Reanimated/Worklets를 맞추고 lockfile을 고정한다. 선택한 실제 버전·peer dependencies·타입 정의를 기록한다.
- [ ] 실패 테스트: 번들 한글 폰트로 “오늘도, 천천히” 문단을 그린 출력은 1080×1920이며 텍스트 영역에 비투명 픽셀이 존재해야 한다.
- [ ] 테스트 실패를 확인하고 실제 paragraph→offscreen surface→PNG 경로를 구현한다. GPU readback 가능 경로를 설치된 API로 확인한다.
- [ ] npx expo install --check, npx expo-doctor, npm run typecheck 실행. 렌더 검증과 네이티브 검증은 별도로 기록한다.

## Task 2 — 입력·설정·프레임 계약

**Files:** src/domain/text.ts, src/domain/frame.ts, src/domain/random.ts, src/storage/settings.ts, tests/domain.test.ts, tests/storage.test.ts.
**Interfaces:** validateText(raw:string): ValidationResult; random(seed:number):()=>number; loadSettings(id:SceneId):Promise<SceneSettings|null>; saveSettings(id:SceneId, settings:SceneSettings):Promise<void>; freezeFrame(state:FrameState):Readonly<FrameState>.
FrameState는 sceneId, text, seed, elapsedMs, reveal, interaction, 작품별 discriminated settings를 포함한다.

- [ ] 실패 테스트: 40 grapheme 허용/41 거절, 3줄 허용/4줄 거절, 한글 조합형·완성형, emoji 거절, 공백 전용 오류, 원본 편집값 불변.
- [ ] 실패 테스트: 동일 seed 재현, 서로 다른 seed 변화, 프레임 고정 뒤 원본 변경 영향 없음.
- [ ] 실패 테스트: 손상 저장 데이터는 안전한 초기값, 빈 문구는 빈 상태 보존, 오래된 load 결과는 최신 편집을 덮지 않음, 연속 저장 순서 유지.
- [ ] 각 실패 확인 후 최소 구현하고 npm test 전체 실행.

## Task 3 — 한글 마스크와 자수 렌더러

**Files:** src/render/text-mask.ts, src/render/geometry.ts, src/scenes/embroidery/config.ts, src/scenes/embroidery/render.ts, tests/text-mask.test.ts, tests/embroidery.test.ts.
**Interfaces:** prepareText(text:string, scale:number, generation:number):Promise<TextResource>; buildStitches(mask:MaskPixels, spacing:number, seed:number):Stitch[]; drawEmbroidery(canvas:SkCanvas, frame:FrameState, resources:SceneResources):void.

- [ ] 실패 테스트: 문단 맞춤/줄 수/최소 크기 초과 오류, 이전 generation 결과 폐기, resize와 출력 scale에서 동일 논리 구도.
- [ ] 실패 테스트: 마스크 밖 stitch 없음, 동일 입력 재현, 상한 6000 cells, 두 대각선 교차, reveal=1에서 전체 stitch.
- [ ] 실제 paragraph 전체 마스크를 샘플링한다. 화면과 출력은 목표 scale에 맞게 재생성하되 논리 격자는 공유한다.
- [ ] 천 짜임·구멍·그림자·두 실의 명암을 Skia picture/path로 배치한다. React Native View 반복 금지.
- [ ] 0/0.8/1.6초 실제 렌더 이미지를 확인하고 글리프 누락·겹침·밀도·X 교차를 점검한다.

## Task 4 — 화면·시계·제스처와 비 작품

**Files:** app/index.tsx, app/scene/[id].tsx, src/ui/TextEditor.tsx, src/ui/SceneControls.tsx, src/scenes/registry.ts, src/scenes/rain/render.ts, src/render/useSceneClock.ts, tests/scene-state.test.ts, tests/rain.test.ts.
**Interfaces:** drawRain(canvas:SkCanvas, frame:FrameState, resources:SceneResources):void; nextPlayback(state:PlaybackState,event:PlaybackEvent):PlaybackState; toLogicalPoint(point:Point,viewport:Rect):Point|null.

- [ ] 실패 테스트: 갤러리·비활성·백그라운드에서는 시간 정지, 자수 1600ms에 완료, reduce motion 초기 완성 정지, 수동 재생/정지 상태 보존.
- [ ] 실패 테스트: 비 y가 시간 증가에 따라 위로 이동, seed 재현, 최대 140입자, 마스크 내부 물 약화, 터치 clear 효과가 문구 마스크를 바꾸지 않음.
- [ ] UI thread shared values와 cached resources로 프레임 작업을 구성한다. 프레임당 전체화면 setState나 큰 배열 생성 금지.
- [ ] 갤러리는 같은 작품 렌더러의 정지 프레임을 보여준다. 편집 패널은 키보드 회피·명시적 적용·인라인 오류를 제공한다.
- [ ] 감상 모드에서 작은 이동 탭과 drag를 구분한다. 스크린리더용 종료 액션과 최초 안내를 제공한다.
- [ ] 접근성 버튼 이름·역할·선택상태, 최소44pt터치, 낮/밤대비와 9:16 letterbox 확인.

## Task 5 — 공유 트랜잭션

**Files:** src/export/export-frame.ts, src/export/temp-files.ts, tests/export.test.ts.
**Interfaces:** exportFrame(frame:Readonly<FrameState>,resources:SceneResources):Promise<string>; shareFrame(deps:ShareDependencies):Promise<ShareOutcome>.

- [ ] 실패 테스트: 미준비/0크기/빈문구/중복요청 거절, 정지프레임 일관성, 실패 후 재시도, 공유취소 정상처리.
- [ ] 실패 테스트: 공유 전 재생이었던 경우만 재개, 백그라운드·unmount에서는 재개 안함, 공유중인 임시파일 삭제 금지.
- [ ] 1080×1920 offscreen 재렌더 후 PNG 저장. 캔버스 밖 UI는 아예 renderer 입력에 포함하지 않는다.
- [ ] OS 공유 시트 종료를 delivered가 아닌 dismissed로 기록한다. 파일은 즉시삭제하지 않고 다음 실행에 24시간 이상 지난 비활성 파일만 정리한다.
- [ ] 화면고정프레임/출력PNG의 문구·구도·seed·시간 비교. 양 플랫폼 공유시트는 실제 실행 여부를 별도 표기한다.

## Task 6 — 최종 검증·인수 자료

**Files:** README.md, docs/verification.md, docs/compatibility.md, assets/licenses/\*, examples/images/\*.png.

- [ ] npm test, npm run typecheck, npm run lint, npx expo install --check, npx expo-doctor, npx expo export --platform all 실행하고 원문 결과 보존.
- [ ] 가능한 렌더 환경에서 두 작품 실제 PNG를 생성·픽셀/육안 검증한다. imagegen 그림을 앱 출력 증거로 대체하지 않는다.
- [ ] iOS/Android 개발빌드 실행절차, 한국어IME, 재진입, Reduce Motion, 빠른변경, 감상탭/드래그, 공유취소·실패의 수동 체크리스트 제공.
- [ ] 수행 플랫폼과 미수행 플랫폼을 분리. 실제 기기 60fps·GPU캡처·OS공유는 미측정이면 미검증으로 남긴다.
- [ ] 소스 archive, 실제 PNG, 버전/라이선스/실행명령과 남은 한계 최대3개 전달. 승인 없는 원격게시·배포는 하지 않는다.

## 공식 확인 출처 (2026-10-19)

- https://expo.dev/changelog/sdk-58
- https://docs.expo.dev/versions/v58.0.0/sdk/skia/
- https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/

## 자체 검토

원문12개섹션의 핵심흐름은 위6개 작업에 배정했다. 계획 승인 후 소스와 로컬 검증을 진행했다. 실제 검증 상태는 verification.md가 기준이며, CI는 원격 저장소 준비 후 실행한다.
