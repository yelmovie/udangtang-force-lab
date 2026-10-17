import type { ReactNode } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

// 게임 색감(src/style.css :root와 같은 값)
export const C = {
  bg: '#f4ead6', surface: '#fffaf0', border: '#dfd5bc',
  teal: '#0d7779', tealDark: '#09595a', tealSoft: '#dcf2ed',
  orange: '#ef923e', orangeDark: '#b8621c', orangeSoft: '#fde3c8',
  ink: '#173d40', sub: '#657b77',
  wood: '#c5894a', woodDark: '#87552d', metal: '#9fb1b1', metalDark: '#5f7474',
  apple: '#d9534a', leaf: '#4a9875', screen: '#0f3b3d', digit: '#bff5d8',
};

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0→1 스프링(Remotion spring, delay는 프레임). */
export function useSpringAt(delay: number, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame, fps, delay, config: { damping: 12, stiffness: 140, ...config } });
}

/** frame 구간 [from,to]에서 0→1, 끝은 고정. */
export function useProgress(from: number, to: number, easing: (t: number) => number = Easing.inOut(Easing.cubic)) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { ...clamp, easing });
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const Stage = ({ children }: { children: ReactNode }) => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <svg width={1280} height={720} viewBox="0 0 1280 720">{children}</svg>
  </AbsoluteFill>
);

/** 오른쪽(+x)을 가리키는 힘 화살표. (x,y)는 꼬리 가운데. */
export const Arrow = ({ x, y, length, thickness, angle = 0, color = C.orange, stroke = C.orangeDark, opacity = 1, outline = false }:
  { x: number; y: number; length: number; thickness: number; angle?: number; color?: string; stroke?: string; opacity?: number; outline?: boolean }) => {
  const head = Math.min(length * .6, Math.max(26, thickness * 1.1));
  const shaft = Math.max(0, length - head);
  const t = thickness / 2, hw = Math.max(t + 10, thickness * .95);
  const points = [[0, -t], [shaft, -t], [shaft, -hw], [length, 0], [shaft, hw], [shaft, t], [0, t]].map(p => p.join(',')).join(' ');
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      <polygon points={points} fill={outline ? 'none' : color} stroke={stroke} strokeWidth={outline ? 4 : 3} strokeDasharray={outline ? '10 7' : undefined} strokeLinejoin="round" />
    </g>
  );
};

/** 나무 상자. (x,y)는 가운데, 위에 금속 부품 parts개를 쌓는다. */
export const Crate = ({ x, y, size = 110, parts = 0, angle = 0, opacity = 1 }: { x: number; y: number; size?: number; parts?: number; angle?: number; opacity?: number }) => {
  const s = size, h = s / 2, p = s * .26;
  const rows = parts <= 1 ? [parts] : parts === 3 ? [2, 1] : [3, 2];
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} opacity={opacity}>
      {rows.map((count, row) => Array.from({ length: count }, (_, i) => (
        <rect key={`${row}-${i}`} x={(i - (count - 1) / 2) * (p + 4) - p / 2} y={-h - (row + 1) * (p + 2) + 2} width={p} height={p} rx={5}
          fill={C.metal} stroke={C.metalDark} strokeWidth={3} />
      )))}
      <rect x={-h} y={-h} width={s} height={s} rx={10} fill={C.wood} stroke={C.woodDark} strokeWidth={5} />
      <path d={`M${-h + 8} ${-h / 3} H${h - 8} M${-h + 8} ${h / 3} H${h - 8}`} stroke={C.woodDark} strokeWidth={4} opacity={.55} />
      <path d={`M${-h + 10} ${-h + 10} L${h - 10} ${h - 10}`} stroke={C.woodDark} strokeWidth={5} opacity={.4} />
    </g>
  );
};

/** 반짝 별. */
export const Sparkle = ({ x, y, size, color = C.orange, opacity = 1 }: { x: number; y: number; size: number; color?: string; opacity?: number }) => {
  if (size <= .01 || opacity <= .01) return null;
  const s = size, k = s * .28;
  return <path transform={`translate(${x} ${y})`} opacity={opacity} fill={color}
    d={`M0 ${-s} Q${k} ${-k} ${s} 0 Q${k} ${k} 0 ${s} Q${-k} ${k} ${-s} 0 Q${-k} ${-k} 0 ${-s} Z`} />;
};

/** 경로 그리기: progress 0→1 만큼 선이 그려진다. */
export const DrawPath = ({ d, progress, color, width = 5, opacity = 1, fill = 'none' }: { d: string; progress: number; color: string; width?: number; opacity?: number; fill?: string }) =>
  progress <= 0 ? null : <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - progress} stroke={color} strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" fill={fill} opacity={opacity} />;

/** 점선 직선을 (x1,y1)에서 (x2,y2) 쪽으로 progress만큼 그린다. */
export const DottedLine = ({ x1, y1, x2, y2, progress, color, width = 5, dash = '2 12', opacity = 1 }:
  { x1: number; y1: number; x2: number; y2: number; progress: number; color: string; width?: number; dash?: string; opacity?: number }) =>
  progress <= 0 ? null : <line x1={x1} y1={y1} x2={lerp(x1, x2, progress)} y2={lerp(y1, y2, progress)} stroke={color} strokeWidth={width}
    strokeDasharray={dash} strokeLinecap="round" opacity={opacity} />;

/** 0→1 사이를 오가는 맥박(반짝임용). */
export const pulse = (frame: number, start: number, period = 18) => frame < start ? 0 : .5 - .5 * Math.cos(((frame - start) / period) * Math.PI * 2);
