# Little Scenes

짧은 문구를 린넨 자수, 빗물 유리창, 동전으로 긁는 복권으로 표현하는 오프라인 React Native 앱입니다.

## 시작

Node 24 LTS와 npm을 사용합니다. 이름·scheme·식별자는 `app.json`에서 변경합니다.

```sh
npm ci
npm run start
# 별도 터미널, 해당 플랫폼 SDK가 설치된 환경
npm run ios
npm run android
```

Expo Go가 아니라 **개발 빌드** 기준입니다. iOS 로컬 실행은 Xcode와 CocoaPods, Android 로컬 실행은 Android SDK/JDK와 에뮬레이터 또는 기기가 필요합니다. GitHub Actions는 Linux에서 품질 검사와 JavaScript 내보내기만 실행하며 네이티브 빌드는 하지 않습니다. 네이티브 빌드와 기기·Maestro 확인은 로컬에서 합니다. 스토어 배포나 유료 EAS 빌드는 하지 않습니다.

## 구현 범위

- 실제 렌더러를 재사용하는 정지 갤러리, 작품 상세, 문구 편집, 작품별 조절(자수: 실 팔레트·글자 방향·땀 간격 / 빗물: 낮·밤·빗물 양).
- 공통 텍스트 처리: 번들 Gaegu 손글씨(누락 글리프는 Noto Sans KR)로 가로 문단 또는 세로쓰기(오른쪽 열부터, 단어 단위 줄바꿈) 레이아웃 → 2배 해상도 글리프 마스크 → 세선화(skeleton)로 획 중심선 추출.
- 손자수: 획 중심선을 따라 아우트라인(stem)·백·체인 스티치와 프렌치 노트를 놓고, 작은 ㅇ 고리는 같은 크기의 꽃(데이지·폼폼·장미)으로 피어나며, 획 끝에 작은 꽃봉오리와 잎을 답니다. 팔레트는 들꽃(다색)·붉은 실·남색 실. 린넨은 이음매 없는 직조 타일과 저해상도 얼룩을 합성합니다. 수놓기 모션은 바느질 순서대로 드러납니다.
- 빗물 유리창: 흐릿한 거리 불빛(보케) 배경, 고르지 않은 김, 뒤집힌 풍경을 비추는 렌즈형 물방울, 손가락으로 닦은 글씨(획 순서대로 쓰임)와 획 아래로 흘러내린 자국, 아래로 미끄러지며 길을 내는 큰 물방울, 드래그하면 3.2초 동안 남는 닦인 자국. 유체 시뮬레이션이 아닌 합성 근사입니다.
- 복권: 기울어진 동전 날(17×2.2 논리 픽셀 반지름)의 방향성 접촉면, 누적 마모·금속 광택·거친 잔여 은박·지연 후 떨어지는 조각. 0°/45°/90° 날 방향, 다시 덮기, 접근성용 모두 열기. 실제 재료 물성 시뮬레이션이 아닌 시각적 근사이며 압력 센서를 사용하지 않습니다. 문구·동전 각도는 저장하지만 긁은 상태는 화면 세션에만 유지됩니다. PNG에는 현재 긁힘과 은박 조각이 포함되고 조작용 동전은 빠집니다.
- UI thread 시계, 자수 1.6초 후 정지, 배경/화면 이탈 시 프레임 콜백 중지, Reduce Motion 초기 정지.
- 40 grapheme/3줄 적용 검증. 입력 중 한국어 조합은 자르지 않습니다. 명시적 문구 비우기는 저장되며 공유만 비활성화합니다.
- UI 없는 1080×1920 PNG와 OS 공유 시트. 공유 시트 종료는 전달 성공을 뜻하지 않습니다.
- AsyncStorage 최근 설정, 연속 쓰기 직렬화, 손상 데이터 fallback, 세대별 리소스 결과 보호.

## 검증

```sh
npm test
npm run typecheck
npm run lint
npm run render:check
npx expo install --check
npx expo-doctor
npx expo export --platform all
```

`render:check`는 실제 CanvasKit/Skia로 같은 작품 컴포넌트를 렌더링해 `examples/`에 PNG를 생성합니다. `RENDER_ALL=1 RENDER_OUT=<dir>`를 주면 가로쓰기·팔레트·절반 수놓기·낮 장면 변형도 그립니다. 생성형 이미지나 앱 스크린샷이 아닙니다. Linux의 이 검증은 iOS/Android GPU·제스처·OS 공유 검증을 대체하지 않습니다.

`.github/workflows/ci.yml` runs typecheck, lint, domain tests, the production Worklet transform regression, all Skia render variants (`RENDER_ALL=1`), dependency checks, and iOS/Android/Web JavaScript exports on Linux.
Native builds and Maestro flows are no longer automatic CI gates.
The retained `.maestro/` flows support local device checks.
See [the CI validation contract](docs/ci-validation.md) for coverage and limits.

## 구조

- `src/app`: Expo Router 화면. `scene/[id].tsx`에서 수명·편집·제스처·공유 조정.
- `src/domain`: 입력, seed, 프레임, 좌표, 동시 실행 제어.
- `src/render`: 글자 레이아웃(`text-layout`), 획 추출(`strokes`), 작품별 배치 계획(`embroidery`, `rain`, 순수 함수·단위 테스트 대상), 스프라이트 시트·SkSL 재질(`sprites`, `shaders`), 캐시되는 리소스 조립(`resources`), 프레임별 값(`motion`, 화면 worklet과 내보내기가 공유).
- `src/scenes/artwork.tsx`: UI가 없는 세 작품의 공통 화면/출력 렌더 트리. 스티치·물방울은 Skia `Atlas` 한 번의 그리기로 처리합니다.
- `src/export`: UI thread에서 고정한 상태를 CPU Skia surface에 재렌더링하고 임시 PNG 공유.
- `src/storage`: 작품별 작은 설정 저장. 글리프/마스크는 저장하지 않음.

렌더 좌표는 360×640이며, PNG는 같은 트리를 3배 해상도로 그립니다. 스티치·꽃·획은 벡터 배치(스프라이트 + RSXform)이고, 유리층·물방울 이미지는 1080×1920으로 미리 그리므로 화면 캡처 단순 확대가 아닙니다. 화면/출력은 문구·seed·설정·시계·터치 강도·손가락 자국을 공유합니다. 리소스는 바뀐 입력만 다시 만듭니다(글자 획, 배경, 유리층을 각각 캐시). 새 리소스를 준비하는 동안 직전 작품을 그대로 보여주고, 준비가 끝나기 전에는 공유를 막습니다. Skia Surface.Make의 CPU 경로를 사용해 GPU 텍스처 readback 의존을 피합니다. 공유 중 파일은 삭제하지 않고, 다음 앱 시작 때 24시간 지난 전용 캐시만 정리합니다.

## 작품 추가 최소 절차

1. `SceneId`와 설정 타입, 기본값/저장 검증에 새 작품을 추가합니다.
2. `scenes/registry.ts`에 이름·설명·감상 종류를 추가합니다.
3. `src/render`에 순수 배치 계획(공통 `strokes` 재사용)과 `resources.ts` 분기를 추가하고, `artwork`에 UI 없는 렌더 분기를 추가합니다. 프레임마다 바뀌는 값은 `motion.ts`의 worklet으로 둡니다.
4. 실제 렌더 회귀 테스트·기본 PNG·Maestro 진입/공유 흐름을 추가합니다.

범용 플러그인 시스템이나 원격 콘텐츠 로더는 없습니다.

## 폰트·에셋

- Gaegu Regular/Bold: Google Fonts, SIL Open Font License 1.1. `assets/licenses/Gaegu-OFL.txt` 동봉.
- Noto Sans KR variable TTF: Google Fonts / Noto, SIL Open Font License 1.1. `assets/licenses/NotoSansKR-OFL.txt` 동봉.
- 원본: https://github.com/google/fonts/tree/main/ofl/notosanskr
- 천, 비, 배경과 조명은 코드로 만든 절차적 그래픽입니다.
- 앱 아이콘은 Expo 템플릿의 기본 아이콘이며 출시 전 교체가 필요합니다. 템플릿 MIT 고지는 LICENSE에 보존합니다.

## 검증 경계

한국어 IME 실제 조합, VoiceOver/TalkBack, 물리 기기 60fps·발열, 다른 앱으로의 실제 전달은 별도 기기 검증 대상입니다. CI는 네이티브 빌드나 에뮬레이터를 실행하지 않으므로 이를 대신하지 않습니다. 자세한 체크리스트는 `docs/verification.md`를 참고하세요.
