import { interpolate, useCurrentFrame } from 'remotion';
import { Arrow, C, clamp, Crate, DottedLine, lerp, Sparkle, Stage, useProgress, useSpringAt } from '../theme';

// 공방: 직접 들기의 굵은 화살표 → 빗면 위 가는 화살표로 바뀌고 대신 이동 경로 점선이 길게 그려짐.
// 이어서 지레 받침점이 화물 쪽으로 미끄러지며 손 화살표가 가늘어짐.
const GROUND = 600, SHELF = { x: 520, w: 260, top: 360 }, SIZE = 100;
const FOOT = { x: 60, y: GROUND }, TOP = { x: SHELF.x, y: SHELF.top };
const RAMP_LEN = Math.hypot(TOP.x - FOOT.x, TOP.y - FOOT.y);
const D = { x: (TOP.x - FOOT.x) / RAMP_LEN, y: (TOP.y - FOOT.y) / RAMP_LEN };
const N = { x: D.y, y: -D.x };
const SLOPE = (Math.atan2(D.y, D.x) * 180) / Math.PI;
const onRamp = (u: number, lift = SIZE / 2) => ({ x: FOOT.x + D.x * RAMP_LEN * u + N.x * lift, y: FOOT.y + D.y * RAMP_LEN * u + N.y * lift });
const LIFT_X = 875, THICK = 44, THIN = 14, RAMP_ARROW = 90;

const RampScene = () => {
  const frame = useCurrentFrame();
  const enter = useSpringAt(0, { damping: 12 });
  const crateIn = useSpringAt(8, { damping: 11 });
  const thickIn = useSpringAt(18, { damping: 12 });
  const shortPath = useProgress(26, 46);
  const lift = useProgress(40, 62);
  const slide = useProgress(62, 76);
  const rampIn = useSpringAt(80, { damping: 13 });
  const morph = useSpringAt(84, { damping: 15, stiffness: 120 });
  const longPath = useProgress(96, 118);
  const climb = useProgress(104, 130);
  const done = useSpringAt(130, { damping: 9 });
  const liftY = lerp(GROUND - SIZE / 2, SHELF.top - SIZE / 2, lift);
  const thickTail = { x: LIFT_X + 100, y: liftY + 60 };
  const u = lerp(.3, .9, climb), crate = onRamp(u);
  const thinTail = { x: crate.x - D.x * (SIZE / 2 + 8 + RAMP_ARROW), y: crate.y - D.y * (SIZE / 2 + 8 + RAMP_ARROW) };
  const morphing = frame >= 84;
  return (
    <g opacity={enter}>
      <line x1={30} x2={1250} y1={GROUND} y2={GROUND} stroke={C.woodDark} strokeWidth={6} strokeLinecap="round" opacity={.45} />
      <rect x={SHELF.x} y={SHELF.top} width={SHELF.w} height={GROUND - SHELF.top} rx={8} fill="#e8c592" stroke={C.woodDark} strokeWidth={5} />
      <path d={`M${SHELF.x} ${SHELF.top + 80} H${SHELF.x + SHELF.w} M${SHELF.x} ${SHELF.top + 160} H${SHELF.x + SHELF.w}`} stroke={C.woodDark} strokeWidth={4} opacity={.4} />
      {/* 직접 들기: 짧은 길, 굵은 화살표 */}
      <DottedLine x1={LIFT_X - 60} y1={GROUND} x2={LIFT_X - 60} y2={SHELF.top} progress={shortPath} color={C.tealDark} width={7} />
      {shortPath >= 1 && <path d={`M${LIFT_X - 76} ${GROUND} H${LIFT_X - 44} M${LIFT_X - 76} ${SHELF.top} H${LIFT_X - 44}`} stroke={C.tealDark} strokeWidth={5} strokeLinecap="round" />}
      <Arrow x={thickTail.x} y={thickTail.y} length={120 * thickIn} thickness={THICK} angle={-90} opacity={thickIn > .02 ? (morphing ? .35 : 1) : 0} />
      <Crate x={lerp(LIFT_X, SHELF.x + SHELF.w - SIZE / 2 - 5, slide)} y={liftY + (1 - crateIn) * -40} size={SIZE} opacity={crateIn} />
      {/* 빗면: 긴 길, 가는 화살표 */}
      {frame >= 80 && (
        <g>
          <path d={`M${FOOT.x} ${FOOT.y} L${TOP.x} ${GROUND} L${TOP.x} ${TOP.y} Z`} fill="#e8c592" stroke={C.woodDark} strokeWidth={5} strokeLinejoin="round"
            opacity={rampIn} transform={`translate(0 ${(1 - rampIn) * 30})`} />
          <DottedLine x1={FOOT.x + N.x * 14} y1={FOOT.y + N.y * 14} x2={TOP.x + N.x * 14} y2={TOP.y + N.y * 14} progress={longPath} color={C.tealDark} width={7} />
          <Crate x={crate.x} y={crate.y} angle={SLOPE} size={SIZE} opacity={rampIn} />
          <Arrow x={lerp(thickTail.x, thinTail.x, morph)} y={lerp(thickTail.y, thinTail.y, morph)} length={lerp(120, RAMP_ARROW, morph)}
            thickness={lerp(THICK, THIN, morph)} angle={lerp(-90, SLOPE, morph)} />
          <Sparkle x={TOP.x} y={TOP.y - 30} size={22 * done} color={C.teal} opacity={done} />
        </g>
      )}
    </g>
  );
};

const LeverScene = () => {
  const frame = useCurrentFrame();
  const enter = useSpringAt(140, { damping: 13 });
  const slide = useSpringAt(160, { damping: 16, stiffness: 70 });
  const press = useProgress(206, 228);
  const done = useSpringAt(226, { damping: 9 });
  const fx = lerp(640, 430, slide), beamY = 470, load = 290, hand = 1000;
  const ratio = (fx - load) / (hand - fx);
  const thickness = 10 + 40 * ratio, start = 10 + 40 * ((640 - load) / (hand - 640));
  const angle = 7 * press;
  return (
    <g opacity={enter} transform={`translate(0 ${(1 - enter) * 30})`}>
      <line x1={30} x2={1250} y1={GROUND} y2={GROUND} stroke={C.woodDark} strokeWidth={6} strokeLinecap="round" opacity={.45} />
      <g transform={`rotate(${angle} ${fx} ${beamY})`}>
        <rect x={220} y={beamY - 18} width={840} height={18} rx={9} fill={C.wood} stroke={C.woodDark} strokeWidth={5} />
        <Crate x={load} y={beamY - 18 - SIZE / 2} size={SIZE} parts={5} />
        {frame >= 166 && <Arrow x={hand} y={beamY - 170} length={120} thickness={start} angle={90} outline stroke={C.orangeDark} opacity={.55} />}
        <Arrow x={hand} y={beamY - 170} length={120} thickness={thickness} angle={90} />
      </g>
      <path d={`M${fx} ${beamY} L${fx - 62} ${GROUND} H${fx + 62} Z`} fill={C.teal} stroke={C.tealDark} strokeWidth={5} strokeLinejoin="round" />
      <Sparkle x={hand + 70} y={beamY - 120} size={20 * done} color={C.teal} opacity={done} />
    </g>
  );
};

export const WorkshopClip = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [132, 142], [1, 0], clamp);
  return (
    <Stage>
      {out > 0 && <g opacity={out}><RampScene /></g>}
      {frame >= 138 && <LeverScene />}
    </Stage>
  );
};
