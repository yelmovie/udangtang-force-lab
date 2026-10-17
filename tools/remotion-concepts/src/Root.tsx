import { Composition } from 'remotion';
import { CargoClip } from './clips/Cargo';
import { BalanceClip } from './clips/Balance';
import { ScaleClip } from './clips/Scale';
import { WorkshopClip } from './clips/Workshop';
import { CoreClip } from './clips/Core';

// 미션별 개념 클립. 무음·글자 없음(자막은 게임 DOM이 시간에 맞춰 얹는다).
// 길이를 바꾸면 src/conceptClip.ts의 자막 시간도 같이 고친다.
export const clips = [
  { id: 'cargo', component: CargoClip, seconds: 7 },
  { id: 'balance', component: BalanceClip, seconds: 7 },
  { id: 'scale', component: ScaleClip, seconds: 7 },
  { id: 'workshop', component: WorkshopClip, seconds: 8 },
  { id: 'rescue', component: CoreClip, seconds: 7 },
] as const;

export const Root = () => (
  <>
    {clips.map(clip => (
      <Composition key={clip.id} id={clip.id} component={clip.component} durationInFrames={clip.seconds * 30} fps={30} width={1280} height={720} />
    ))}
  </>
);
