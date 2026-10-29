# Dependency compatibility

2026-10-29 유지보수 후보 기준입니다.
`expo install`과 온라인 호환성 검사를 통과한 SDK 58 조합을 사용하며, 설치 버전은 `package-lock.json`으로 확인합니다.

| Package           | Installed |
| ----------------- | --------- |
| Expo              | 58.0.21   |
| React Native      | 0.88.0    |
| React             | 19.3.0    |
| React Native Skia | 2.14.0    |
| Reanimated        | 4.7.1     |
| Worklets          | 0.13.0    |
| Gesture Handler   | 3.3.0     |
| Expo Router       | 58.0.28   |
| Expo FileSystem   | 58.0.13   |
| Expo Sharing      | 58.0.21   |
| AsyncStorage      | 2.2.0     |

Expo Doctor와 온라인 `expo install --check`를 실행해 호환성을 확인했습니다.
Expo Go 가용성을 전제로 하지 않습니다.

React Native 최신 패치 `0.88.1`은 설치된 SDK의 `bundledNativeModules.json`에 있지만, 온라인 검사에서는 `0.88.0`을 요구하며 `0.88.1` 후보를 거부했습니다.
검사 제외 항목을 추가하지 않고 설치기가 선택하는 `0.88.0`을 유지합니다.
React `19.3.0`, AsyncStorage `2.2.0`, Gesture Handler `~3.3.0`, Safe Area Context `~5.10.1`, Worklets `0.13.0`도 SDK 호환 범위를 유지합니다.
TypeScript는 ESLint parser가 요구하는 `<6.1` 범위 안의 `~6.0.3`을 사용합니다.
ESLint 10과 Expo에 포함된 일부 플러그인의 peer 범위 경고는 설치 로그에 남아 있으며, 실제 프로젝트 lint 결과와 구분해 기록합니다.

## 보안 예외

기존 `node-forge` 예외는 설치된 `1.4.2`가 `GHSA-86w9-cpqp-85rv`의 영향 범위인 `<=1.4.0` 밖에 있어 제거했습니다.
`deepmerge@4.3.1`의 `GHSA-gcqx-w48m-w2h4`는 최신 릴리스와 advisory에 패치가 없어 `osv-scanner.toml`에 명시적 예외로 남깁니다.
Expo 설정·빌드 도구에서 쓰는 경로이며, 이 예외는 위험 수용이지 취약점 수정이 아닙니다.
npm audit의 low 7건도 이 예외로 사라지지 않습니다.
기기 실행과 OS 공유 검증은 JavaScript 내보내기 및 CanvasKit 검사와 별도로 수행해야 합니다.

## API 확인 사항

- Skia 2.14: immutable Path와 별도 PathBuilder. 생성 시 builder.detach() 사용.
- Paragraph.paint(canvas,x,y)와 line metrics로 전체 문단을 렌더링. 글자를 각각 고정폭으로 그리지 않음.
- Surface.Make는 CPU surface. drawAsPicture로 같은 JSX를 기록한 뒤 목표 크기 surface에 렌더링. 실제 PNG 인코딩 확인.
- Worklets runOnUISync로 시계·reveal·터치를 한 번에 고정하고 모션을 멈춤.
- SharedValue get/set 사용. 프레임마다 React setState 하지 않음. 자수 완료 시 한 번만 JS 상태를 변경.
- FileSystem File/Directory/Paths, 비동기 File.write 사용. legacy API와 섞지 않음.

## 공식 문서

- https://expo.dev/changelog/sdk-58
- https://docs.expo.dev/versions/v58.0.0/sdk/skia/
- https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/
- https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/
- https://docs.expo.dev/versions/v58.0.0/sdk/sharing/
- 설치된 각 패키지의 src 및 타입 선언을 함께 대조했습니다.
