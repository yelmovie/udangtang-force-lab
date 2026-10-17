import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, clamp, DrawPath, lerp, Sparkle, Stage, useProgress, useSpringAt } from '../theme';

// 저울: 빈 저울 15 → 0 버튼 → 0 → 사과 80. 화면이 반으로 갈라져 '영점 전 95'와 '영점 후 80'이 나란히.
// 숫자는 저울 표시창의 7분할 막대 그림이고, 단위·설명은 게임 DOM 자막이 맡는다.
const SEGMENTS: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
const Digit = ({ x, y, d, color }: { x: number; y: number; d: string | null; color: string }) => {
  const w = 44, h = 66, t = 10;
  const rects: Record<string, [number, number, number, number]> = {
    a: [t / 2, 0, w - t, t], b: [w - t, t / 2, t, h / 2 - t / 2], c: [w - t, h / 2, t, h / 2 - t / 2], d: [t / 2, h - t, w - t, t],
    e: [0, h / 2, t, h / 2 - t / 2], f: [0, t / 2, t, h / 2 - t / 2], g: [t / 2, h / 2 - t / 2, w - t, t],
  };
  const on = d === null ? '' : SEGMENTS[d];
  return <g transform={`translate(${x} ${y})`}>{Object.entries(rects).map(([k, [rx, ry, rw, rh]]) =>
    <rect key={k} x={rx} y={ry} width={rw} height={rh} rx={4} fill={color} opacity={on.includes(k) ? 1 : .1} />)}</g>;
};

const Device = ({ x, y, k = 1, value, digit = C.digit, button = C.orange, buttonDark = C.orangeDark, press = 0, apple = -1 }:
  { x: number; y: number; k?: number; value: number; digit?: string; button?: string; buttonDark?: string; press?: number; apple?: number }) => {
  const text = String(Math.max(0, Math.round(value)));
  const digits = text.length === 1 ? [null, text] : [text[0], text[1]];
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {apple >= 0 && (
        <g transform={`translate(0 ${-(1 - apple) * 320})`} opacity={Math.min(1, apple * 3)}>
          <path d="M0 -128 C-6 -146 4 -156 12 -162" stroke={C.woodDark} strokeWidth={6} fill="none" strokeLinecap="round" />
          <path d="M8 -142 C28 -160 50 -150 52 -138 C34 -128 18 -132 8 -142 Z" fill={C.leaf} />
          <circle cx={0} cy={-86} r={46} fill={C.apple} stroke="#9c2f28" strokeWidth={5} />
        </g>
      )}
      <rect x={-230} y={-40} width={460} height={24} rx={10} fill={C.metal} stroke={C.metalDark} strokeWidth={4} />
      <rect x={-22} y={-18} width={44} height={20} fill={C.metalDark} />
      <rect x={-210} y={0} width={420} height={170} rx={28} fill={C.teal} stroke={C.tealDark} strokeWidth={6} />
      <rect x={-160} y={36} width={220} height={98} rx={14} fill={C.screen} />
      <Digit x={-108} y={52} d={digits[0]} color={digit} />
      <Digit x={-52} y={52} d={digits[1]} color={digit} />
      <g transform={`translate(122 85) scale(${1 - press * .12})`}>
        <circle r={36} fill={button} stroke={buttonDark} strokeWidth={5} />
        <ellipse rx={11} ry={15} fill="none" stroke="#fff" strokeWidth={6} />
      </g>
    </g>
  );
};

const Finger = ({ x, y, opacity }: { x: number; y: number; opacity: number }) => (
  <g transform={`translate(${x} ${y})`} opacity={opacity}>
    <rect x={-17} y={-120} width={34} height={120} rx={17} fill="#fff5d7" stroke={C.woodDark} strokeWidth={4} />
    <rect x={-40} y={-170} width={80} height={70} rx={26} fill="#fff5d7" stroke={C.woodDark} strokeWidth={4} />
  </g>
);

export const ScaleClip = () => {
  const frame = useCurrentFrame();
  const enter = useSpringAt(0, { damping: 12 });
  const fingerIn = useProgress(14, 32, Easing.out(Easing.quad));
  const fingerOut = useProgress(42, 56);
  const press = interpolate(frame, [32, 35, 40, 44], [0, 1, 1, 0], clamp);
  const zeroDone = useSpringAt(54, { damping: 9 });
  const apple = useSpringAt(62, { damping: 11, stiffness: 120 });
  const count = useProgress(78, 100, Easing.out(Easing.cubic));
  const stable = useSpringAt(100, { damping: 9 });
  const value = frame < 40 ? 15 : frame < 78 ? lerp(15, 0, progressAt(frame, 40, 54)) : frame < 100 ? 80 * count + Math.sin(frame * 1.7) * 5 * (1 - count) : 80;
  const single = interpolate(frame, [110, 124], [1, 0], clamp);
  const split = useSpringAt(114, { damping: 14 });
  const divider = useProgress(112, 132);
  const circle = useProgress(140, 166);
  const check = useProgress(158, 180);
  const [lx, ly, rx] = [340, 360, 940];
  const cx = lx - 45 * .8, cy = ly + 85 * .8, ex = 100, ey = 54;
  return (
    <Stage>
      {single > 0 && (
        <g opacity={single} transform={`translate(${640 * (1 - single)} ${400 * (1 - single)}) scale(${single})`}>
          <g transform={`translate(0 ${(1 - enter) * 40})`} opacity={enter}>
            <line x1={260} x2={1020} y1={612} y2={612} stroke={C.woodDark} strokeWidth={6} strokeLinecap="round" opacity={.45} />
            <Device x={640} y={420} k={1.1} value={value} press={press} apple={frame >= 62 ? apple : -1}
              button={frame >= 40 ? C.teal : C.orange} buttonDark={frame >= 40 ? C.tealDark : C.orangeDark} />
            <Finger x={640 + 122 * 1.1} y={420 + 85 * 1.1 - 40 + lerp(-160, 0, fingerIn) - fingerOut * 180} opacity={fingerIn * (1 - fingerOut)} />
            <Sparkle x={530} y={432} size={22 * zeroDone} color={C.teal} opacity={frame < 78 ? zeroDone : 0} />
            <Sparkle x={460} y={432} size={26 * stable} opacity={stable} />
          </g>
        </g>
      )}
      {frame >= 112 && (
        <g>
          <DrawPath d="M640 70 V650" progress={divider} color={C.tealDark} width={6} />
          <g opacity={split} transform={`translate(${(1 - split) * 120} 0)`}>
            <rect x={60} y={80} width={540} height={560} rx={30} fill={C.surface} stroke={C.border} strokeWidth={4} />
            <Device x={lx} y={ly} k={.8} value={95} digit="#ffc58a" button="#c9c3b4" buttonDark="#8f8a7d" apple={1} />
            <DrawPath progress={circle} color={C.orange} width={8}
              d={`M${cx + ex} ${cy} C${cx + ex} ${cy - ey * 1.35} ${cx - ex} ${cy - ey * 1.35} ${cx - ex} ${cy} C${cx - ex} ${cy + ey * 1.35} ${cx + ex * 1.06} ${cy + ey * 1.3} ${cx + ex * 1.03} ${cy - ey * .3}`} />
          </g>
          <g opacity={split} transform={`translate(${-(1 - split) * 120} 0)`}>
            <rect x={680} y={80} width={540} height={560} rx={30} fill={C.surface} stroke={C.border} strokeWidth={4} />
            <Device x={rx} y={ly} k={.8} value={80} button={C.teal} buttonDark={C.tealDark} apple={1} />
            <DrawPath d="M1080 190 L1112 224 L1170 156" progress={check} color={C.teal} width={14} />
            <Sparkle x={1170} y={150} size={20 * check} color={C.teal} opacity={check} />
          </g>
        </g>
      )}
    </Stage>
  );
};

function progressAt(frame: number, from: number, to: number) {
  return interpolate(frame, [from, to], [0, 1], clamp);
}
