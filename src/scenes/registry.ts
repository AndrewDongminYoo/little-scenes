import type { SceneId } from '../domain/model';
export const scenes: {
  id: SceneId;
  name: string;
  description: string;
  kind: string;
}[] = [
  {
    id: 'embroidery',
    name: '손글씨 자수',
    description: '린넨 위에 한 땀씩, 오늘의 마음을 남겨요.',
    kind: '수놓은 뒤 정지',
  },
  {
    id: 'rain',
    name: '빗물 유리창',
    description: '김 서린 창에 손끝으로 마음을 남겨요.',
    kind: '계속 흐르는 모션',
  },
  {
    id: 'scratch',
    name: '행운의 복권',
    description: '은박 아래 숨긴 문장을 동전으로 꺼내요.',
    kind: '손끝으로 긁는 카드',
  },
];
