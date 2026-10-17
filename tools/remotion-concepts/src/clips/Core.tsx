import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { Arrow, C, clamp, Crate, DrawPath, lerp, pulse, Sparkle, Stage, useProgress, useSpringAt } from '../theme';

// 코어: 네 미션의 도구가 콜아웃 선을 따라 코어로 모인다 → 같은 작은 힘으로
// 짧고 가파른 길은 멈춤, 길고 완만한 길은 도착을 나란히.
const CORE = { x: 640, y: 340 };
const icons = [
  { x: 170, y: 130, kind: 'cargo' }, { x: 1110, y: 130, kind: 'balance' },
  { x: 170, y: 560, kind: 'scale' }, { x: 1110, y: 560, kind: 'workshop' },
] as const;
const control = (p: { x: number; y: number }) => ({ x: p.x * .35 + CORE.x * .65, y: p.y });
const bezier = (p: { x: number; y: number }, t: number) => {
  const q = control(p), a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
  return { x: a * p.x + b * q.x + c * CORE.x, y: a * p.y + b * q.y + c * CORE.y };
};

const Icon = ({ kind }: { kind: typeof icons[number]['kind'] }) => (
  <g>
    <rect x={-48} y={-48} width={96} height={96} rx={20} fill={C.surface} stroke={C.border} strokeWidth={4} />
    {kind === 'cargo' && <Crate x={0} y={8} size={44} parts={1} />}
    {kind === 'balance' && <g><rect x={-34} y={-8} width={68} height={8} rx={4} fill={C.wood} /><path d="M0 0 L-14 26 H14 Z" fill={C.teal} /><rect x={-34} y={-24} width={16} height={16} rx={3} fill={C.teal} /><circle cx={26} cy={-15} r={7} fill={C.orange} /></g>}
    {kind === 'scale' && <g><rect x={-32} y={-24} width={64} height={8} rx={4} fill={C.metal} /><rect x={-28} y={-12} width={56} height={36} rx={8} fill={C.teal} /><rect x={-20} y={-4} width={26} height={16} rx={3} fill={C.screen} /><circle cx={16} cy={4} r={6} fill={C.orange} /></g>}
    {kind === 'workshop' && <g><path d="M-34 26 L30 26 L30 -16 Z" fill="#e8c592" stroke={C.woodDark} strokeWidth={3} strokeLinejoin="round" /><rect x={-6} y={-6} width={18} height={18} rx={3} fill={C.wood} transform="rotate(-33 3 3)" /></g>}
  </g>
);

const Orb = ({ x, y, r, glow = 0 }: { x: number; y: number; r: number; glow?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    {glow > 0 && <circle r={r * (1.25 + glow * .25)} fill={C.tealSoft} opacity={.8} />}
    <circle r={r} fill={C.teal} stroke={C.tealDark} strokeWidth={Math.max(3, r * .08)} />
    <circle r={r * .55} fill="none" stroke={C.orange} strokeWidth={Math.max(3, r * .16)} />
    <circle r={r * .2} fill="#fff5d7" />
  </g>
);

type Ramp = { foot: { x: number; y: number }; top: { x: number; y: number }; platform: number };
const ramps: Ramp[] = [
  { foot: { x: 240, y: 600 }, top: { x: 450, y: 300 }, platform: 590 },
  { foot: { x: 680, y: 600 }, top: { x: 1110, y: 300 }, platform: 1230 },
];
const R = 30, ARROW = 70;
function along(ramp: Ramp, u: number) {
  const len = Math.hypot(ramp.top.x - ramp.foot.x, ramp.top.y - ramp.foot.y);
  const d = { x: (ramp.top.x - ramp.foot.x) / len, y: (ramp.top.y - ramp.foot.y) / len }, n = { x: d.y, y: -d.x };
  const c = { x: ramp.foot.x + d.x * len * u + n.x * R, y: ramp.foot.y + d.y * len * u + n.y * R };
  return { c, d, n, tail: { x: c.x - d.x * (R + 6 + ARROW), y: c.y - d.y * (R + 6 + ARROW) }, angle: (Math.atan2(d.y, d.x) * 180) / Math.PI };
}

const Gather = () => {
  const frame = useCurrentFrame();
  const coreIn = useSpringAt(0, { damping: 11 });
  const iconIn = useSpringAt(6, { damping: 12 });
  const lines = useProgress(12, 32);
  const travel = useProgress(30, 48, Easing.in(Easing.cubic));
  const flash = interpolate(frame, [48, 62], [0, 1], clamp);
  return (
    <g>
      {icons.map(icon => {
        const q = control(icon);
        return <DrawPath key={icon.kind} d={`M${icon.x} ${icon.y} Q${q.x} ${q.y} ${CORE.x} ${CORE.y}`} progress={lines} color={C.orange} width={5} opacity={1 - travel * .6} />;
      })}
      {icons.map(icon => {
        const p = bezier(icon, travel), k = iconIn * lerp(1, .3, travel);
        return <g key={icon.kind} transform={`translate(${p.x} ${p.y}) scale(${k})`} opacity={1 - interpolate(travel, [.8, 1], [0, 1], clamp)}><Icon kind={icon.kind} /></g>;
      })}
      {flash > 0 && flash < 1 && <circle cx={CORE.x} cy={CORE.y} r={lerp(80, 170, flash)} fill="none" stroke={C.orange} strokeWidth={10} opacity={1 - flash} />}
      <g transform={`translate(${CORE.x} ${CORE.y}) scale(${coreIn}) translate(${-CORE.x} ${-CORE.y})`}>
        <Orb x={CORE.x} y={CORE.y} r={70} glow={frame >= 48 ? pulse(frame, 48, 14) : 0} />
      </g>
    </g>
  );
};

const Compare = () => {
  const frame = useCurrentFrame();
  const enter = useSpringAt(62, { damping: 14 });
  const ready = useSpringAt(80, { damping: 12 });
  const shortUp = useProgress(96, 128, Easing.out(Easing.quad));
  const slipBack = useProgress(138, 154);
  const stop = useSpringAt(130, { damping: 8 });
  const longUp = useProgress(96, 168, Easing.inOut(Easing.sin));
  const rings = useProgress(150, 172);
  const arrive = useSpringAt(168, { damping: 9 });
  const glow = pulse(frame, 172, 18);
  const short = along(ramps[0], lerp(.3, .62, shortUp) - .1 * slipBack);
  const long = along(ramps[1], lerp(.3, 1, longUp));
  const runs = [short, long];
  return (
    <g opacity={enter} transform={`translate(0 ${(1 - enter) * 40})`}>
      {ramps.map((ramp, i) => (
        <g key={i}>
          <rect x={i ? 660 : 40} y={90} width={580} height={550} rx={30} fill={C.surface} stroke={C.border} strokeWidth={4} />
          <line x1={i ? 680 : 60} x2={i ? 1220 : 600} y1={600} y2={600} stroke={C.woodDark} strokeWidth={5} strokeLinecap="round" opacity={.45} />
          <path d={`M${ramp.foot.x} ${ramp.foot.y} L${ramp.top.x} ${ramp.foot.y} L${ramp.top.x} ${ramp.top.y} Z`} fill="#e8c592" stroke={C.woodDark} strokeWidth={5} strokeLinejoin="round" />
          <rect x={ramp.top.x} y={ramp.top.y} width={ramp.platform - ramp.top.x} height={600 - ramp.top.y} rx={6} fill="#e8c592" stroke={C.woodDark} strokeWidth={5} />
          <g opacity={ready}>
            <Arrow x={runs[i].tail.x} y={runs[i].tail.y} length={ARROW} thickness={14} angle={runs[i].angle} />
            <Orb x={runs[i].c.x} y={runs[i].c.y} r={R} />
            <DrawPath progress={rings} color={C.orange} width={5}
              d={`M${runs[i].tail.x + runs[i].d.x * 35 + 58} ${runs[i].tail.y + runs[i].d.y * 35} a58 58 0 1 0 -116 0 a58 58 0 1 0 116 0`} />
          </g>
        </g>
      ))}
      {/* 짧고 가파른 길: 멈춤 표시 */}
      <g transform={`translate(${short.c.x + short.d.x * 70 + short.n.x * 50} ${short.c.y + short.d.y * 70 + short.n.y * 50}) scale(${stop})`}>
        <path d="M-12 -29 H12 L29 -12 V12 L12 29 H-12 L-29 12 V-12 Z" fill={C.orange} stroke={C.orangeDark} strokeWidth={4} strokeLinejoin="round" />
        <rect x={-16} y={-5} width={32} height={10} rx={4} fill="#fff" />
      </g>
      {/* 길고 완만한 길: 도착 */}
      <line x1={ramps[1].top.x} x2={ramps[1].platform} y1={ramps[1].top.y} y2={ramps[1].top.y} stroke={C.teal} strokeWidth={10} strokeLinecap="round" opacity={arrive * (.6 + .4 * glow)} />
      <Sparkle x={1150} y={250} size={22 * arrive * (1 + glow * .3)} color={C.teal} opacity={arrive} />
      <Sparkle x={1210} y={270} size={14 * arrive} opacity={arrive} />
    </g>
  );
};

export const CoreClip = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [56, 66], [1, 0], clamp);
  return (
    <Stage>
      {out > 0 && <g opacity={out}><Gather /></g>}
      {frame >= 60 && <Compare />}
    </Stage>
  );
};
