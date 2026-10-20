// Five concept clips as frame → SVG functions. Silent, no text: the game overlays captions (src/conceptClip.ts).
// If a clip's length changes, update the caption times in src/conceptClip.ts too.
import { Arrow, C, Crate, DottedLine, DrawPath, Easing, H, Sparkle, Stage, el, g, interpolate, lerp, progress, pulse, spring, t } from './theme.mjs';

const sp = (frame, delay, config) => spring(frame, delay, config);

/* ---------- 배송소: 같은 힘으로 부품 1개·5개 상자를 동시에 밀기 ---------- */
function cargo(f) {
  const START = 270, SIZE = 110, ARROW = 150;
  const lanes = [{ y: 190, parts: 1, distance: 620, bar: C.orange }, { y: 520, parts: 5, distance: 250, bar: C.teal }];
  const tailX = START - SIZE / 2 - ARROW - 8;
  const enter = sp(f, 0, { damping: 11 }), arrowIn = sp(f, 20, { damping: 13 });
  const move = progress(f, 40, 88, Easing.out(Easing.cubic));
  const contact = Math.min(move * 620, 30);
  const ghost = interpolate(f, [60, 76], [1, 0.3]);
  const bars = sp(f, 90, { damping: 7, stiffness: 90 });
  const drop = progress(f, 118, 134), bracket = progress(f, 132, 150);
  const fly = sp(f, 160, { damping: 15, stiffness: 110 }), flying = f >= 158;
  // Ending: both push arrows stand one above the other on a board, and two guide lines at their
  // tails and heads show they are the same length (overlapping them hid one arrow from 3rd graders).
  const board = progress(f, 156, 168), guides = progress(f, 180, 198), glow = pulse(f, 196, 20);
  const BX = 985, TOP = 335, BOTTOM = 415;
  const heavyEnd = START - SIZE / 2 + lanes[1].distance, lightEnd = START - SIZE / 2 + lanes[0].distance;
  return Stage(
    lanes.map(lane => {
      const ground = lane.y + SIZE / 2;
      return g({ opacity: enter },
        el('line', { x1: 40, x2: 1240, y1: ground, y2: ground, stroke: C.woodDark, strokeWidth: 6, strokeLinecap: 'round', opacity: 0.45 }),
        el('line', { x1: START - SIZE / 2 - 4, x2: START - SIZE / 2 - 4, y1: lane.y - 110, y2: ground + 44, stroke: C.teal, strokeWidth: 5, strokeDasharray: '12 9' }),
        el('rect', { x: START - SIZE / 2, y: ground + 16, width: Math.max(0, lane.distance * bars), height: 18, rx: 9, fill: lane.bar }),
        Arrow({ x: tailX + contact, y: lane.y, length: ARROW * arrowIn, thickness: 28, opacity: arrowIn > 0.02 ? (flying ? 0.28 : ghost) : 0 }),
        Crate({ x: START + lane.distance * move, y: lane.y + (1 - enter) * -40, size: SIZE, parts: lane.parts }));
    }),
    DottedLine({ x1: heavyEnd, y1: lanes[1].y + SIZE / 2 + 25, x2: heavyEnd, y2: lanes[0].y + SIZE / 2 + 25, progress: drop, color: C.tealDark, width: 5, dash: '3 12' }),
    DrawPath({ d: `M${heavyEnd} ${lanes[0].y + 98} Q${(heavyEnd + lightEnd) / 2} ${lanes[0].y + 140} ${lightEnd} ${lanes[0].y + 98}`, progress: bracket, color: C.orangeDark, width: 6 }),
    Sparkle({ x: lightEnd, y: lanes[0].y + 90, size: 22 * bracket, opacity: bracket }),
    g({ opacity: board },
      el('rect', { x: BX - 92, y: TOP - 52, width: ARROW + 152, height: BOTTOM - TOP + 104, rx: 22, fill: C.surface, stroke: C.border, strokeWidth: 4 }),
      Crate({ x: BX - 46, y: TOP, size: 44, parts: 1 }), Crate({ x: BX - 46, y: BOTTOM, size: 44, parts: 5 })),
    flying && g({},
      Arrow({ x: lerp(tailX + 30, BX, fly), y: lerp(lanes[0].y, TOP, fly), length: ARROW, thickness: 28 }),
      Arrow({ x: lerp(tailX + 30, BX, fly), y: lerp(lanes[1].y, BOTTOM, fly), length: ARROW, thickness: 28 }),
      DottedLine({ x1: BX, y1: TOP - 38, x2: BX, y2: BOTTOM + 38, progress: guides, color: C.tealDark, width: 5, dash: '3 11' }),
      DottedLine({ x1: BX + ARROW, y1: TOP - 38, x2: BX + ARROW, y2: BOTTOM + 38, progress: guides, color: C.tealDark, width: 5, dash: '3 11' }),
      Sparkle({ x: BX, y: TOP - 44, size: 16 * guides * (1 + glow * 0.4), color: C.teal, opacity: guides }),
      Sparkle({ x: BX + ARROW, y: TOP - 44, size: 16 * guides * (1 + glow * 0.4), color: C.teal, opacity: guides })),
  );
}

/* ---------- 균형: 같은 거리 → 무거운 쪽이 내려감 → 같은 무게면 수평 ---------- */
function balance(f) {
  const PX = 640, PY = 420, HALF = 320, DROP = 120;
  const Weight = (x, y, opacity = 1) => g({ transform: t(x, y), opacity },
    el('circle', { cx: 0, cy: -74, r: 13, fill: 'none', stroke: C.tealDark, strokeWidth: 7 }),
    el('path', { d: 'M-46 0 L-31 -64 H31 L46 0 Z', fill: C.teal, stroke: C.tealDark, strokeWidth: 5, strokeLinejoin: 'round' }));
  const Ball = (x, y, opacity = 1) => g({ opacity }, el('circle', { cx: x, cy: y - 26, r: 26, fill: C.orange, stroke: C.orangeDark, strokeWidth: 5 }));
  const anchor = (side, angle) => {
    const r = (angle * Math.PI) / 180, dx = side * HALF, dy = -10;
    return { x: PX + dx * Math.cos(r) - dy * Math.sin(r), y: PY + dx * Math.sin(r) + dy * Math.cos(r) };
  };
  const Pan = (x, y) => g({},
    el('path', { d: `M${x} ${y} L${x - 62} ${y + DROP} M${x} ${y} L${x + 62} ${y + DROP}`, stroke: C.woodDark, strokeWidth: 4 }),
    el('circle', { cx: x, cy: y, r: 8, fill: C.woodDark }),
    el('path', { d: `M${x - 80} ${y + DROP} Q${x} ${y + DROP + 36} ${x + 80} ${y + DROP} Z`, fill: C.wood, stroke: C.woodDark, strokeWidth: 5, strokeLinejoin: 'round' }));
  const enter = sp(f, 0, { damping: 12 }), dot = sp(f, 14, { damping: 9 }), ruler = progress(f, 20, 58);
  const heavyIn = sp(f, 60, { damping: 13 }), lightIn = sp(f, 64, { damping: 13 });
  const tilt = sp(f, 80, { damping: 14, stiffness: 90 });
  const swapOut = progress(f, 116, 132), twinIn = sp(f, 128, { damping: 13 });
  const settle = sp(f, 142, { damping: 5, stiffness: 100 });
  const levelLine = progress(f, 172, 188), glow = pulse(f, 188, 16);
  const angle = -9 * tilt + 9 * settle;
  const left = anchor(-1, angle), right = anchor(1, angle);
  const rulerFade = interpolate(f, [70, 90], [1, 0.45]);
  return Stage(
    el('line', { x1: 120, x2: 1160, y1: 616, y2: 616, stroke: C.woodDark, strokeWidth: 6, strokeLinecap: 'round', opacity: 0.45 * enter }),
    g({ opacity: enter, transform: t(0, (1 - enter) * 30) },
      el('path', { d: `M${PX} ${PY} L${PX - 70} 596 H${PX + 70} Z`, fill: C.teal, stroke: C.tealDark, strokeWidth: 5, strokeLinejoin: 'round' }),
      el('rect', { x: PX - 110, y: 592, width: 220, height: 24, rx: 10, fill: C.tealDark }),
      g({ transform: `rotate(${angle} ${PX} ${PY})` },
        el('rect', { x: PX - HALF - 20, y: PY - 20, width: HALF * 2 + 40, height: 20, rx: 10, fill: C.wood, stroke: C.woodDark, strokeWidth: 5 }),
        g({ opacity: rulerFade },
          [-1, 1].map(side => g({},
            el('line', { x1: PX, x2: PX + side * HALF * ruler, y1: PY - 54, y2: PY - 54, stroke: C.teal, strokeWidth: 6, strokeLinecap: 'round' }),
            [1, 2, 3, 4, 5].map(n => n / 5 <= ruler + 0.001 &&
              el('line', { x1: PX + (side * HALF * n) / 5, x2: PX + (side * HALF * n) / 5, y1: PY - 68, y2: PY - 40, stroke: C.teal, strokeWidth: 5, strokeLinecap: 'round' })))),
          el('circle', { cx: PX, cy: PY - 54, r: 12 * dot, fill: C.orange, stroke: C.orangeDark, strokeWidth: 4 })))),
    g({ opacity: enter },
      Pan(left.x, left.y), Pan(right.x, right.y),
      Weight(left.x, left.y + DROP - (1 - heavyIn) * 260, heavyIn),
      Ball(right.x, right.y + DROP - (1 - lightIn) * 260 - swapOut * 240, Math.min(lightIn, 1 - swapOut)),
      f >= 128 && Weight(right.x, right.y + DROP - (1 - twinIn) * 260, twinIn)),
    levelLine > 0 && g({},
      el('line', { x1: lerp(PX, 200, levelLine), x2: lerp(PX, 1080, levelLine), y1: PY - 10, y2: PY - 10, stroke: C.orange, strokeWidth: 6,
        strokeDasharray: '18 12', strokeLinecap: 'round', opacity: 0.55 + 0.45 * glow }),
      Sparkle({ x: 200, y: PY - 10, size: levelLine * (20 + glow * 10) }),
      Sparkle({ x: 1080, y: PY - 10, size: levelLine * (20 + glow * 10) })),
  );
}

/* ---------- 저울: 빈 저울 15 → 영점 → 사과 80, 영점 전 95와 나란히 ---------- */
function scale(f) {
  const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const Digit = (x, y, d, color) => {
    const w = 44, h = 66, k = 10;
    const rects = { a: [k / 2, 0, w - k, k], b: [w - k, k / 2, k, h / 2 - k / 2], c: [w - k, h / 2, k, h / 2 - k / 2], d: [k / 2, h - k, w - k, k],
      e: [0, h / 2, k, h / 2 - k / 2], f: [0, k / 2, k, h / 2 - k / 2], g: [k / 2, h / 2 - k / 2, w - k, k] };
    const on = d === null ? '' : SEGMENTS[d];
    return g({ transform: t(x, y) }, Object.entries(rects).map(([key, [rx, ry, rw, rh]]) =>
      el('rect', { x: rx, y: ry, width: rw, height: rh, rx: 4, fill: color, opacity: on.includes(key) ? 1 : 0.1 })));
  };
  const Device = ({ x, y, k = 1, value, digit = C.digit, button = C.orange, buttonDark = C.orangeDark, press = 0, apple = -1 }) => {
    const text = String(Math.max(0, Math.round(value)));
    const digits = text.length === 1 ? [null, text] : [text[0], text[1]];
    return g({ transform: `${t(x, y)} scale(${k})` },
      apple >= 0 && g({ transform: t(0, -(1 - apple) * 320), opacity: Math.min(1, apple * 3) },
        el('path', { d: 'M0 -128 C-6 -146 4 -156 12 -162', stroke: C.woodDark, strokeWidth: 6, fill: 'none', strokeLinecap: 'round' }),
        el('path', { d: 'M8 -142 C28 -160 50 -150 52 -138 C34 -128 18 -132 8 -142 Z', fill: C.leaf }),
        el('circle', { cx: 0, cy: -86, r: 46, fill: C.apple, stroke: '#9c2f28', strokeWidth: 5 })),
      el('rect', { x: -230, y: -40, width: 460, height: 24, rx: 10, fill: C.metal, stroke: C.metalDark, strokeWidth: 4 }),
      el('rect', { x: -22, y: -18, width: 44, height: 20, fill: C.metalDark }),
      el('rect', { x: -210, y: 0, width: 420, height: 170, rx: 28, fill: C.teal, stroke: C.tealDark, strokeWidth: 6 }),
      el('rect', { x: -160, y: 36, width: 220, height: 98, rx: 14, fill: C.screen }),
      Digit(-108, 52, digits[0], digit), Digit(-52, 52, digits[1], digit),
      g({ transform: `${t(122, 85)} scale(${1 - press * 0.12})` },
        el('circle', { r: 36, fill: button, stroke: buttonDark, strokeWidth: 5 }),
        el('ellipse', { rx: 11, ry: 15, fill: 'none', stroke: '#fff', strokeWidth: 6 })));
  };
  const Finger = (x, y, opacity) => g({ transform: t(x, y), opacity },
    el('rect', { x: -17, y: -120, width: 34, height: 120, rx: 17, fill: '#fff5d7', stroke: C.woodDark, strokeWidth: 4 }),
    el('rect', { x: -40, y: -170, width: 80, height: 70, rx: 26, fill: '#fff5d7', stroke: C.woodDark, strokeWidth: 4 }));
  const enter = sp(f, 0, { damping: 12 });
  const fingerIn = progress(f, 14, 32, Easing.out(Easing.quad)), fingerOut = progress(f, 42, 56);
  const press = interpolate(f, [32, 35, 40, 44], [0, 1, 1, 0]);
  const zeroDone = sp(f, 54, { damping: 9 }), apple = sp(f, 62, { damping: 11, stiffness: 120 });
  const count = progress(f, 78, 100, Easing.out(Easing.cubic)), stable = sp(f, 100, { damping: 9 });
  const value = f < 40 ? 15 : f < 78 ? lerp(15, 0, interpolate(f, [40, 54], [0, 1])) : f < 100 ? 80 * count + Math.sin(f * 1.7) * 5 * (1 - count) : 80;
  const single = interpolate(f, [110, 124], [1, 0]);
  const split = sp(f, 114, { damping: 14 }), divider = progress(f, 112, 132);
  const circle = progress(f, 140, 166), check = progress(f, 158, 180);
  const [lx, ly, rx] = [340, 360, 940];
  const cx = lx - 45 * 0.8, cy = ly + 85 * 0.8, ex = 100, ey = 54;
  return Stage(
    single > 0 && g({ opacity: single, transform: `${t(640 * (1 - single), 400 * (1 - single))} scale(${single})` },
      g({ transform: t(0, (1 - enter) * 40), opacity: enter },
        el('line', { x1: 260, x2: 1020, y1: 612, y2: 612, stroke: C.woodDark, strokeWidth: 6, strokeLinecap: 'round', opacity: 0.45 }),
        Device({ x: 640, y: 420, k: 1.1, value, press, apple: f >= 62 ? apple : -1,
          button: f >= 40 ? C.teal : C.orange, buttonDark: f >= 40 ? C.tealDark : C.orangeDark }),
        Finger(640 + 122 * 1.1, 420 + 85 * 1.1 - 40 + lerp(-160, 0, fingerIn) - fingerOut * 180, fingerIn * (1 - fingerOut)),
        Sparkle({ x: 530, y: 432, size: 22 * zeroDone, color: C.teal, opacity: f < 78 ? zeroDone : 0 }),
        Sparkle({ x: 460, y: 432, size: 26 * stable, opacity: stable }))),
    f >= 112 && g({},
      DrawPath({ d: 'M640 70 V650', progress: divider, color: C.tealDark, width: 6 }),
      g({ opacity: split, transform: t((1 - split) * 120, 0) },
        el('rect', { x: 60, y: 80, width: 540, height: 560, rx: 30, fill: C.surface, stroke: C.border, strokeWidth: 4 }),
        Device({ x: lx, y: ly, k: 0.8, value: 95, digit: '#ffc58a', button: '#c9c3b4', buttonDark: '#8f8a7d', apple: 1 }),
        DrawPath({ progress: circle, color: C.orange, width: 8,
          d: `M${cx + ex} ${cy} C${cx + ex} ${cy - ey * 1.35} ${cx - ex} ${cy - ey * 1.35} ${cx - ex} ${cy} C${cx - ex} ${cy + ey * 1.35} ${cx + ex * 1.06} ${cy + ey * 1.3} ${cx + ex * 1.03} ${cy - ey * 0.3}` })),
      g({ opacity: split, transform: t(-(1 - split) * 120, 0) },
        el('rect', { x: 680, y: 80, width: 540, height: 560, rx: 30, fill: C.surface, stroke: C.border, strokeWidth: 4 }),
        Device({ x: rx, y: ly, k: 0.8, value: 80, button: C.teal, buttonDark: C.tealDark, apple: 1 }),
        DrawPath({ d: 'M1080 190 L1112 224 L1170 156', progress: check, color: C.teal, width: 14 }),
        Sparkle({ x: 1170, y: 150, size: 20 * check, color: C.teal, opacity: check }))),
  );
}

/* ---------- 공방: 직접 들기 ↔ 빗면, 이어서 지레 받침점 이동 ---------- */
function workshop(f) {
  const GROUND = 600, SHELF = { x: 520, w: 260, top: 360 }, SIZE = 100;
  const FOOT = { x: 60, y: GROUND }, TOP = { x: SHELF.x, y: SHELF.top };
  const RAMP_LEN = Math.hypot(TOP.x - FOOT.x, TOP.y - FOOT.y);
  const D = { x: (TOP.x - FOOT.x) / RAMP_LEN, y: (TOP.y - FOOT.y) / RAMP_LEN }, N = { x: D.y, y: -D.x };
  const SLOPE = (Math.atan2(D.y, D.x) * 180) / Math.PI;
  const onRamp = (u, lift = SIZE / 2) => ({ x: FOOT.x + D.x * RAMP_LEN * u + N.x * lift, y: FOOT.y + D.y * RAMP_LEN * u + N.y * lift });
  const LIFT_X = 875, THICK = 44, THIN = 14, RAMP_ARROW = 90;

  const ramp = () => {
    const enter = sp(f, 0, { damping: 12 }), crateIn = sp(f, 8, { damping: 11 }), thickIn = sp(f, 18, { damping: 12 });
    const shortPath = progress(f, 26, 46), lift = progress(f, 40, 62), slide = progress(f, 62, 76);
    const rampIn = sp(f, 80, { damping: 13 }), morph = sp(f, 84, { damping: 15, stiffness: 120 });
    const longPath = progress(f, 96, 118), climb = progress(f, 104, 130), done = sp(f, 130, { damping: 9 });
    const liftY = lerp(GROUND - SIZE / 2, SHELF.top - SIZE / 2, lift);
    const thickTail = { x: LIFT_X + 100, y: liftY + 60 };
    const crate = onRamp(lerp(0.3, 0.9, climb));
    const thinTail = { x: crate.x - D.x * (SIZE / 2 + 8 + RAMP_ARROW), y: crate.y - D.y * (SIZE / 2 + 8 + RAMP_ARROW) };
    const morphing = f >= 84;
    return g({ opacity: enter },
      el('line', { x1: 30, x2: 1250, y1: GROUND, y2: GROUND, stroke: C.woodDark, strokeWidth: 6, strokeLinecap: 'round', opacity: 0.45 }),
      el('rect', { x: SHELF.x, y: SHELF.top, width: SHELF.w, height: GROUND - SHELF.top, rx: 8, fill: '#e8c592', stroke: C.woodDark, strokeWidth: 5 }),
      el('path', { d: `M${SHELF.x} ${SHELF.top + 80} H${SHELF.x + SHELF.w} M${SHELF.x} ${SHELF.top + 160} H${SHELF.x + SHELF.w}`, stroke: C.woodDark, strokeWidth: 4, opacity: 0.4 }),
      DottedLine({ x1: LIFT_X - 60, y1: GROUND, x2: LIFT_X - 60, y2: SHELF.top, progress: shortPath, color: C.tealDark, width: 7 }),
      shortPath >= 1 && el('path', { d: `M${LIFT_X - 76} ${GROUND} H${LIFT_X - 44} M${LIFT_X - 76} ${SHELF.top} H${LIFT_X - 44}`, stroke: C.tealDark, strokeWidth: 5, strokeLinecap: 'round' }),
      Arrow({ x: thickTail.x, y: thickTail.y, length: 120 * thickIn, thickness: THICK, angle: -90, opacity: thickIn > 0.02 ? (morphing ? 0.35 : 1) : 0 }),
      Crate({ x: lerp(LIFT_X, SHELF.x + SHELF.w - SIZE / 2 - 5, slide), y: liftY + (1 - crateIn) * -40, size: SIZE, opacity: crateIn }),
      f >= 80 && g({},
        el('path', { d: `M${FOOT.x} ${FOOT.y} L${TOP.x} ${GROUND} L${TOP.x} ${TOP.y} Z`, fill: '#e8c592', stroke: C.woodDark, strokeWidth: 5, strokeLinejoin: 'round',
          opacity: rampIn, transform: t(0, (1 - rampIn) * 30) }),
        DottedLine({ x1: FOOT.x + N.x * 14, y1: FOOT.y + N.y * 14, x2: TOP.x + N.x * 14, y2: TOP.y + N.y * 14, progress: longPath, color: C.tealDark, width: 7 }),
        Crate({ x: crate.x, y: crate.y, angle: SLOPE, size: SIZE, opacity: rampIn }),
        Arrow({ x: lerp(thickTail.x, thinTail.x, morph), y: lerp(thickTail.y, thinTail.y, morph), length: lerp(120, RAMP_ARROW, morph),
          thickness: lerp(THICK, THIN, morph), angle: lerp(-90, SLOPE, morph) }),
        Sparkle({ x: TOP.x, y: TOP.y - 30, size: 22 * done, color: C.teal, opacity: done })));
  };

  const lever = () => {
    const enter = sp(f, 140, { damping: 13 }), slide = sp(f, 160, { damping: 16, stiffness: 70 });
    const press = progress(f, 206, 228), done = sp(f, 226, { damping: 9 });
    const fx = lerp(640, 430, slide), beamY = 470, load = 290, hand = 1000;
    const thickness = 10 + 40 * ((fx - load) / (hand - fx)), start = 10 + 40 * ((640 - load) / (hand - 640));
    const angle = 7 * press;
    return g({ opacity: enter, transform: t(0, (1 - enter) * 30) },
      el('line', { x1: 30, x2: 1250, y1: GROUND, y2: GROUND, stroke: C.woodDark, strokeWidth: 6, strokeLinecap: 'round', opacity: 0.45 }),
      g({ transform: `rotate(${angle} ${fx} ${beamY})` },
        el('rect', { x: 220, y: beamY - 18, width: 840, height: 18, rx: 9, fill: C.wood, stroke: C.woodDark, strokeWidth: 5 }),
        Crate({ x: load, y: beamY - 18 - SIZE / 2, size: SIZE, parts: 5 }),
        f >= 166 && Arrow({ x: hand, y: beamY - 170, length: 120, thickness: start, angle: 90, outline: true, stroke: C.orangeDark, opacity: 0.55 }),
        Arrow({ x: hand, y: beamY - 170, length: 120, thickness, angle: 90 })),
      el('path', { d: `M${fx} ${beamY} L${fx - 62} ${GROUND} H${fx + 62} Z`, fill: C.teal, stroke: C.tealDark, strokeWidth: 5, strokeLinejoin: 'round' }),
      Sparkle({ x: hand + 70, y: beamY - 120, size: 20 * done, color: C.teal, opacity: done }));
  };

  const out = interpolate(f, [132, 142], [1, 0]);
  return Stage(out > 0 && g({ opacity: out }, ramp()), f >= 138 && lever());
}

/* ---------- 코어: 네 도구가 모이고, 같은 힘으로 짧은 길은 멈춤·긴 길은 도착 ---------- */
function rescue(f) {
  const CORE = { x: 640, y: 340 };
  const icons = [{ x: 170, y: 130, kind: 'cargo' }, { x: 1110, y: 130, kind: 'balance' }, { x: 170, y: 560, kind: 'scale' }, { x: 1110, y: 560, kind: 'workshop' }];
  const control = p => ({ x: p.x * 0.35 + CORE.x * 0.65, y: p.y });
  const bezier = (p, s) => { const q = control(p), a = (1 - s) ** 2, b = 2 * (1 - s) * s, c = s * s; return { x: a * p.x + b * q.x + c * CORE.x, y: a * p.y + b * q.y + c * CORE.y }; };
  const Icon = kind => g({},
    el('rect', { x: -48, y: -48, width: 96, height: 96, rx: 20, fill: C.surface, stroke: C.border, strokeWidth: 4 }),
    kind === 'cargo' && Crate({ x: 0, y: 8, size: 44, parts: 1 }),
    kind === 'balance' && g({}, el('rect', { x: -34, y: -8, width: 68, height: 8, rx: 4, fill: C.wood }), el('path', { d: 'M0 0 L-14 26 H14 Z', fill: C.teal }),
      el('rect', { x: -34, y: -24, width: 16, height: 16, rx: 3, fill: C.teal }), el('circle', { cx: 26, cy: -15, r: 7, fill: C.orange })),
    kind === 'scale' && g({}, el('rect', { x: -32, y: -24, width: 64, height: 8, rx: 4, fill: C.metal }), el('rect', { x: -28, y: -12, width: 56, height: 36, rx: 8, fill: C.teal }),
      el('rect', { x: -20, y: -4, width: 26, height: 16, rx: 3, fill: C.screen }), el('circle', { cx: 16, cy: 4, r: 6, fill: C.orange })),
    kind === 'workshop' && g({}, el('path', { d: 'M-34 26 L30 26 L30 -16 Z', fill: '#e8c592', stroke: C.woodDark, strokeWidth: 3, strokeLinejoin: 'round' }),
      el('rect', { x: -6, y: -6, width: 18, height: 18, rx: 3, fill: C.wood, transform: 'rotate(-33 3 3)' })));
  const Orb = (x, y, r, glow = 0) => g({ transform: t(x, y) },
    glow > 0 && el('circle', { r: r * (1.25 + glow * 0.25), fill: C.tealSoft, opacity: 0.8 }),
    el('circle', { r, fill: C.teal, stroke: C.tealDark, strokeWidth: Math.max(3, r * 0.08) }),
    el('circle', { r: r * 0.55, fill: 'none', stroke: C.orange, strokeWidth: Math.max(3, r * 0.16) }),
    el('circle', { r: r * 0.2, fill: '#fff5d7' }));
  const ramps = [{ foot: { x: 240, y: 600 }, top: { x: 450, y: 300 }, platform: 590 }, { foot: { x: 680, y: 600 }, top: { x: 1110, y: 300 }, platform: 1230 }];
  const R = 30, ARROW = 70;
  const along = (ramp, u) => {
    const len = Math.hypot(ramp.top.x - ramp.foot.x, ramp.top.y - ramp.foot.y);
    const d = { x: (ramp.top.x - ramp.foot.x) / len, y: (ramp.top.y - ramp.foot.y) / len }, n = { x: d.y, y: -d.x };
    const c = { x: ramp.foot.x + d.x * len * u + n.x * R, y: ramp.foot.y + d.y * len * u + n.y * R };
    return { c, d, n, tail: { x: c.x - d.x * (R + 6 + ARROW), y: c.y - d.y * (R + 6 + ARROW) }, angle: (Math.atan2(d.y, d.x) * 180) / Math.PI };
  };

  const gather = () => {
    const coreIn = sp(f, 0, { damping: 11 }), iconIn = sp(f, 6, { damping: 12 });
    const lines = progress(f, 12, 32), travel = progress(f, 30, 48, Easing.in(Easing.cubic));
    const flash = interpolate(f, [48, 62], [0, 1]);
    return g({},
      icons.map(icon => { const q = control(icon); return DrawPath({ d: `M${icon.x} ${icon.y} Q${q.x} ${q.y} ${CORE.x} ${CORE.y}`, progress: lines, color: C.orange, width: 5, opacity: 1 - travel * 0.6 }); }),
      icons.map(icon => { const p = bezier(icon, travel), k = iconIn * lerp(1, 0.3, travel);
        return g({ transform: `${t(p.x, p.y)} scale(${k})`, opacity: 1 - interpolate(travel, [0.8, 1], [0, 1]) }, Icon(icon.kind)); }),
      flash > 0 && flash < 1 && el('circle', { cx: CORE.x, cy: CORE.y, r: lerp(80, 170, flash), fill: 'none', stroke: C.orange, strokeWidth: 10, opacity: 1 - flash }),
      g({ transform: `${t(CORE.x, CORE.y)} scale(${coreIn}) ${t(-CORE.x, -CORE.y)}` }, Orb(CORE.x, CORE.y, 70, f >= 48 ? pulse(f, 48, 14) : 0)));
  };

  const compare = () => {
    const enter = sp(f, 62, { damping: 14 }), ready = sp(f, 80, { damping: 12 });
    const shortUp = progress(f, 96, 128, Easing.out(Easing.quad)), slipBack = progress(f, 138, 154);
    const stop = sp(f, 130, { damping: 8 }), longUp = progress(f, 96, 168, Easing.inOut(Easing.sin));
    const rings = progress(f, 150, 172), arrive = sp(f, 168, { damping: 9 }), glow = pulse(f, 172, 18);
    const short = along(ramps[0], lerp(0.3, 0.62, shortUp) - 0.1 * slipBack), long = along(ramps[1], lerp(0.3, 1, longUp));
    const runs = [short, long];
    return g({ opacity: enter, transform: t(0, (1 - enter) * 40) },
      ramps.map((ramp, i) => g({},
        el('rect', { x: i ? 660 : 40, y: 90, width: 580, height: 550, rx: 30, fill: C.surface, stroke: C.border, strokeWidth: 4 }),
        el('line', { x1: i ? 680 : 60, x2: i ? 1220 : 600, y1: 600, y2: 600, stroke: C.woodDark, strokeWidth: 5, strokeLinecap: 'round', opacity: 0.45 }),
        el('path', { d: `M${ramp.foot.x} ${ramp.foot.y} L${ramp.top.x} ${ramp.foot.y} L${ramp.top.x} ${ramp.top.y} Z`, fill: '#e8c592', stroke: C.woodDark, strokeWidth: 5, strokeLinejoin: 'round' }),
        el('rect', { x: ramp.top.x, y: ramp.top.y, width: ramp.platform - ramp.top.x, height: 600 - ramp.top.y, rx: 6, fill: '#e8c592', stroke: C.woodDark, strokeWidth: 5 }),
        g({ opacity: ready },
          Arrow({ x: runs[i].tail.x, y: runs[i].tail.y, length: ARROW, thickness: 14, angle: runs[i].angle }),
          Orb(runs[i].c.x, runs[i].c.y, R),
          DrawPath({ progress: rings, color: C.orange, width: 5,
            d: `M${runs[i].tail.x + runs[i].d.x * 35 + 58} ${runs[i].tail.y + runs[i].d.y * 35} a58 58 0 1 0 -116 0 a58 58 0 1 0 116 0` })))),
      g({ transform: `${t(short.c.x + short.d.x * 70 + short.n.x * 50, short.c.y + short.d.y * 70 + short.n.y * 50)} scale(${stop})` },
        el('path', { d: 'M-12 -29 H12 L29 -12 V12 L12 29 H-12 L-29 12 V-12 Z', fill: C.orange, stroke: C.orangeDark, strokeWidth: 4, strokeLinejoin: 'round' }),
        el('rect', { x: -16, y: -5, width: 32, height: 10, rx: 4, fill: '#fff' })),
      el('line', { x1: ramps[1].top.x, x2: ramps[1].platform, y1: ramps[1].top.y, y2: ramps[1].top.y, stroke: C.teal, strokeWidth: 10, strokeLinecap: 'round', opacity: arrive * (0.6 + 0.4 * glow) }),
      Sparkle({ x: 1150, y: 250, size: 22 * arrive * (1 + glow * 0.3), color: C.teal, opacity: arrive }),
      Sparkle({ x: 1210, y: 270, size: 14 * arrive, opacity: arrive }));
  };

  const out = interpolate(f, [56, 66], [1, 0]);
  return Stage(out > 0 && g({ opacity: out }, gather()), f >= 60 && compare());
}

/** id → { seconds, frame(f) → svg }. Seconds must match the caption times in src/conceptClip.ts. */
export const clips = {
  cargo: { seconds: 7, frame: cargo },
  balance: { seconds: 7, frame: balance },
  scale: { seconds: 7, frame: scale },
  workshop: { seconds: 8, frame: workshop },
  rescue: { seconds: 7, frame: rescue },
};
export { H };
