# Dependency compatibility

2026-10-19 기준. create-expo-app blank-typescript의 안정 템플릿을 사용하고 `expo install`로 SDK 58 조합을 선택했습니다. 개별 major를 임의로 올리지 않았습니다.

| Package           | Installed |
| ----------------- | --------- |
| Expo              | 58.0.14   |
| React Native      | 0.88.0    |
| React             | 19.3.0    |
| React Native Skia | 2.14.0    |
| Reanimated        | 4.7.1     |
| Worklets          | 0.13.0    |
| Gesture Handler   | 3.3.0     |
| Expo Router       | 58.0.23   |
| Expo FileSystem   | 58.0.9    |
| Expo Sharing      | 58.0.19   |
| AsyncStorage      | 2.2.0     |

실제 버전은 package-lock.json이 기준입니다. Expo Doctor 20/20 통과. SDK bundledNativeModules와 설치 버전을 대조했습니다. Expo Go 가용성을 전제로 하지 않습니다.

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
