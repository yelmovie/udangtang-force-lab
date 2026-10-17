import { interpolate, useCurrentFrame } from 'remotion';
import { C, clamp, lerp, pulse, Sparkle, Stage, useProgress, useSpringAt } from '../theme';

// 균형: 받침점에서 양쪽까지 같은 거리 눈금이 그려진다 → 무거운 쪽이 내려감
// → 같은 무게로 바꾸면 수평으로 돌아오고 수평선이 반짝.
const PX = 640, PY = 420, HALF = 320, DROP = 120;

const Weight = ({ x, y, opacity = 1 }: { x: number; y: number; opacity?: number }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <circle cx={0} cy={-74} r={13} fill="none" stroke={C.tealDark} strokeWidth={7} />
    <path d="M-46 0 L-31 -64 H31 L46 0 Z" fill={C.teal} stroke={C.tealDark} strokeWidth={5} strokeLinejoin="round" />
  </g>
);
const Ball = ({ x, y, opacity = 1 }: { x: number; y: number; opacity?: number }) => (
  <g opacity={opacity}><circle cx={x} cy={y - 26} r={26} fill={C.orange} stroke={C.orangeDark} strokeWidth={5} /></g>
);

function anchor(side: -1 | 1, angle: number) {
  const r = (angle * Math.PI) / 180, dx = side * HALF, dy = -10;
  return { x: PX + dx * Math.cos(r) - dy * Math.sin(r), y: PY + dx * Math.sin(r) + dy * Math.cos(r) };
}
const Pan = ({ x, y }: { x: number; y: number }) => (
  <g>
    <path d={`M${x} ${y} L${x - 62} ${y + DROP} M${x} ${y} L${x + 62} ${y + DROP}`} stroke={C.woodDark} strokeWidth={4} />
    <circle cx={x} cy={y} r={8} fill={C.woodDark} />
    <path d={`M${x - 80} ${y + DROP} Q${x} ${y + DROP + 36} ${x + 80} ${y + DROP} Z`} fill={C.wood} stroke={C.woodDark} strokeWidth={5} strokeLinejoin="round" />
  </g>
);

export const BalanceClip = () => {
  const frame = useCurrentFrame();
  const enter = useSpringAt(0, { damping: 12 });
  const dot = useSpringAt(14, { damping: 9 });
  const ruler = useProgress(20, 58);
  const heavyIn = useSpringAt(60, { damping: 13 });
  const lightIn = useSpringAt(64, { damping: 13 });
  const tilt = useSpringAt(80, { damping: 14, stiffness: 90 });
  const swapOut = useProgress(116, 132);
  const twinIn = useSpringAt(128, { damping: 13 });
  const settle = useSpringAt(142, { damping: 5, stiffness: 100 });
  const levelLine = useProgress(172, 188);
  const glow = pulse(frame, 188, 16);
  const angle = -9 * tilt + 9 * settle;
  const left = anchor(-1, angle), right = anchor(1, angle);
  const rulerFade = interpolate(frame, [70, 90], [1, .45], clamp);
  return (
    <Stage>
      <line x1={120} x2={1160} y1={616} y2={616} stroke={C.woodDark} strokeWidth={6} strokeLinecap="round" opacity={.45 * enter} />
      <g opacity={enter} transform={`translate(0 ${(1 - enter) * 30})`}>
        <path d={`M${PX} ${PY} L${PX - 70} 596 H${PX + 70} Z`} fill={C.teal} stroke={C.tealDark} strokeWidth={5} strokeLinejoin="round" />
        <rect x={PX - 110} y={592} width={220} height={24} rx={10} fill={C.tealDark} />
        <g transform={`rotate(${angle} ${PX} ${PY})`}>
          <rect x={PX - HALF - 20} y={PY - 20} width={HALF * 2 + 40} height={20} rx={10} fill={C.wood} stroke={C.woodDark} strokeWidth={5} />
          {/* 받침점에서 양쪽 끝까지 같은 거리 눈금 */}
          <g opacity={rulerFade}>
            {([-1, 1] as const).map(side => (
              <g key={side}>
                <line x1={PX} x2={PX + side * HALF * ruler} y1={PY - 54} y2={PY - 54} stroke={C.teal} strokeWidth={6} strokeLinecap="round" />
                {[1, 2, 3, 4, 5].map(n => n / 5 <= ruler + .001 && (
                  <line key={n} x1={PX + side * HALF * n / 5} x2={PX + side * HALF * n / 5} y1={PY - 68} y2={PY - 40} stroke={C.teal} strokeWidth={5} strokeLinecap="round" />
                ))}
              </g>
            ))}
            <circle cx={PX} cy={PY - 54} r={12 * dot} fill={C.orange} stroke={C.orangeDark} strokeWidth={4} />
          </g>
        </g>
      </g>
      <g opacity={enter}>
        <Pan x={left.x} y={left.y} />
        <Pan x={right.x} y={right.y} />
        <Weight x={left.x} y={left.y + DROP - (1 - heavyIn) * 260} opacity={heavyIn} />
        <Ball x={right.x} y={right.y + DROP - (1 - lightIn) * 260 - swapOut * 240} opacity={Math.min(lightIn, 1 - swapOut)} />
        {frame >= 128 && <Weight x={right.x} y={right.y + DROP - (1 - twinIn) * 260} opacity={twinIn} />}
      </g>
      {/* 같은 무게면 수평: 수평선이 가운데에서 양쪽으로 그려지고 반짝 */}
      {levelLine > 0 && (
        <g>
          <line x1={lerp(PX, 200, levelLine)} x2={lerp(PX, 1080, levelLine)} y1={PY - 10} y2={PY - 10} stroke={C.orange} strokeWidth={6}
            strokeDasharray="18 12" strokeLinecap="round" opacity={.55 + .45 * glow} />
          <Sparkle x={200} y={PY - 10} size={levelLine * (20 + glow * 10)} />
          <Sparkle x={1080} y={PY - 10} size={levelLine * (20 + glow * 10)} />
        </g>
      )}
    </Stage>
  );
};
