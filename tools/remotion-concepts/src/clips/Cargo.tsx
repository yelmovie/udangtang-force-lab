import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { Arrow, C, clamp, Crate, DottedLine, DrawPath, lerp, pulse, Sparkle, Stage, useProgress, useSpringAt } from '../theme';

// 배송소: 같은 길이의 힘 화살표가 부품 1개·5개 상자를 동시에 민다 → 흔적 막대가 스프링처럼 늘어남
// → 길이 차이 콜아웃 → 두 화살표를 겹쳐 '같은 힘' 확인.
const START = 270, SIZE = 110, ARROW = 150;
const lanes = [
  { y: 190, parts: 1, distance: 620, bar: C.orange },
  { y: 520, parts: 5, distance: 250, bar: C.teal },
];
const tailX = START - SIZE / 2 - ARROW - 8;

export const CargoClip = () => {
  const frame = useCurrentFrame();
  const enter = useSpringAt(0, { damping: 11 });
  const arrowIn = useSpringAt(20, { damping: 13 });
  const move = useProgress(40, 88, Easing.out(Easing.cubic));
  const contact = Math.min(move * 620, 30);
  const ghost = interpolate(frame, [60, 76], [1, .3], clamp);
  const bars = useSpringAt(90, { damping: 7, stiffness: 90 });
  const drop = useProgress(118, 134);
  const bracket = useProgress(132, 150);
  const fly = useSpringAt(160, { damping: 15, stiffness: 110 });
  const flying = frame >= 158;
  const ring = useProgress(186, 204);
  const glow = pulse(frame, 186, 20);
  const heavyEnd = START - SIZE / 2 + lanes[1].distance, lightEnd = START - SIZE / 2 + lanes[0].distance;
  return (
    <Stage>
      {lanes.map((lane, i) => {
        const ground = lane.y + SIZE / 2;
        return (
          <g key={i} opacity={enter}>
            <line x1={40} x2={1240} y1={ground} y2={ground} stroke={C.woodDark} strokeWidth={6} strokeLinecap="round" opacity={.45} />
            <line x1={START - SIZE / 2 - 4} x2={START - SIZE / 2 - 4} y1={lane.y - 110} y2={ground + 44} stroke={C.teal} strokeWidth={5} strokeDasharray="12 9" />
            <rect x={START - SIZE / 2} y={ground + 16} width={Math.max(0, lane.distance * bars)} height={18} rx={9} fill={lane.bar} />
            <Arrow x={tailX + contact} y={lane.y} length={ARROW * arrowIn} thickness={28} opacity={arrowIn > .02 ? (flying ? .28 : ghost) : 0} />
            <Crate x={START + lane.distance * move} y={lane.y + (1 - enter) * -40} size={SIZE} parts={lane.parts} />
          </g>
        );
      })}
      {/* 가벼운 상자가 더 간 만큼을 콜아웃으로 강조 */}
      <DottedLine x1={heavyEnd} y1={lanes[1].y + SIZE / 2 + 25} x2={heavyEnd} y2={lanes[0].y + SIZE / 2 + 25} progress={drop} color={C.tealDark} width={5} dash="3 12" />
      <DrawPath d={`M${heavyEnd} ${lanes[0].y + 98} Q${(heavyEnd + lightEnd) / 2} ${lanes[0].y + 140} ${lightEnd} ${lanes[0].y + 98}`} progress={bracket} color={C.orangeDark} width={6} />
      <Sparkle x={lightEnd} y={lanes[0].y + 90} size={22 * bracket} opacity={bracket} />
      {/* 두 화살표를 겹쳐 길이가 같음을 확인 */}
      {flying && (
        <g>
          <Arrow x={lerp(tailX + 30, 565, fly)} y={lerp(lanes[0].y, 355, fly)} length={ARROW} thickness={28} />
          <Arrow x={lerp(tailX + 30, 565, fly)} y={lerp(lanes[1].y, 355, fly)} length={ARROW} thickness={28} outline stroke={C.tealDark} />
          <DrawPath d="M545 355 C545 310 735 310 735 355 C735 400 545 400 545 355 Z" progress={ring} color={C.teal} width={5} opacity={.9} />
          <Sparkle x={565} y={355} size={18 * ring * (1 + glow * .4)} color={C.teal} opacity={ring} />
          <Sparkle x={715} y={355} size={18 * ring * (1 + glow * .4)} color={C.teal} opacity={ring} />
        </g>
      )}
    </Stage>
  );
};
