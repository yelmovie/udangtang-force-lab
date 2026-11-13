import type { StageId } from './data';

export const encounterAtlas = 'encounters/wheel-lock-atlas.webp';
export const attackRange = 95;
export const contactRange = 25;

export const encounterLines: Record<StageId, readonly [string, string]> = {
  cargo: ['바퀴 한 번 잠그면 못 가지!', '바퀴를 꽉 잡았다!'],
  balance: ['이쪽 추를 조금만 밀어 볼까?', '한쪽 다리를 기울여야지!'],
  scale: ['저울 받침을 덜컹대게 해 볼까?', '저울이 자꾸 들썩이지?'],
  workshop: ['빗면 아래 받침을 숨겨야지!', '받침이 어디 갔을까?'],
  rescue: ['코어 운반은 여기서 끝!', '운반대 앞을 가로막아야지!'],
};

type Point = { x: number; y: number };
export type Encounter = Point & {
  id: StageId;
  index: number;
  facing: 1 | -1;
  hitAt: number;
  clampUntil: number;
  visits: number;
  appearedAt: number;
};

export function facingToward(from: Point, to: Point, previous: 1 | -1): 1 | -1 {
  return to.x - from.x > 6 ? 1 : to.x - from.x < -6 ? -1 : previous;
}

export function drawEncounterFrame(
  ctx: CanvasRenderingContext2D, atlas: HTMLImageElement, row: number, frame: number,
  position: Point, facing: 1 | -1, size: number, offsetX = 0, offsetY = 0,
) {
  ctx.save();
  ctx.translate(Math.round(position.x + offsetX), Math.round(position.y + offsetY));
  ctx.scale(facing, 1);
  ctx.drawImage(atlas, frame * 100, row * 100, 100, 100, -size / 2, -size * .95, size, size);
  ctx.restore();
}

export function drawStageProp(ctx: CanvasRenderingContext2D, enemy: Encounter, now: number, still: boolean) {
  const swing = still ? 0 : Math.sin(now / 260 + enemy.index) * 1.5;
  ctx.save();
  ctx.translate(enemy.x - enemy.facing * 31, enemy.y - 8);
  ctx.rotate(swing * .08);
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#39251d';
  ctx.fillStyle = '#efb55f';
  if (enemy.id === 'cargo') {
    ctx.fillStyle = '#453a34'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7bc9b6'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 2 * Math.PI); ctx.fill();
  } else if (enemy.id === 'balance') {
    ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(-5, -4); ctx.lineTo(5, -4); ctx.lineTo(8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeRect(-3, -8, 6, 4);
  } else if (enemy.id === 'scale') {
    ctx.fillStyle = '#6aa99f'; ctx.fillRect(-11, 1, 22, 8); ctx.strokeRect(-11, 1, 22, 8);
    ctx.fillStyle = '#e5d7b4'; ctx.fillRect(-8, -3 - swing, 16, 4); ctx.strokeRect(-8, -3 - swing, 16, 4);
  } else if (enemy.id === 'workshop') {
    ctx.beginPath(); ctx.moveTo(-10, 7); ctx.lineTo(10, 7); ctx.lineTo(10, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ad6542'; ctx.fillRect(4, 7, 6, 3);
  } else {
    ctx.fillStyle = '#c77a45'; ctx.fillRect(-11, -8, 22, 15); ctx.strokeRect(-11, -8, 22, 15);
    ctx.fillStyle = '#ebcc74'; ctx.fillRect(-11, -6, 22, 3); ctx.fillRect(-2, -8, 4, 15);
    ctx.fillStyle = '#4e4039'; ctx.fillRect(-8, 7, 4, 4); ctx.fillRect(4, 7, 4, 4);
  }
  ctx.restore();
}

export function drawWrenchSparks(ctx: CanvasRenderingContext2D, enemy: Encounter, hit: number, elapsed: number) {
  const lifetime = hit === 3 ? 620 : 310;
  if (elapsed < 80 || elapsed > lifetime) return;
  const t = (elapsed - 80) / (lifetime - 80);
  ctx.save();
  ctx.globalAlpha = 1 - t;
  for (let n = 0; n < hit * 3; n++) {
    const angle = Math.PI * (1.05 + .9 * n / (hit * 3));
    const speed = 25 + 9 * (n % 3);
    const x = enemy.x + enemy.facing * 14 + Math.cos(angle) * t * speed;
    const y = enemy.y - 28 + Math.sin(angle) * t * speed + t * t * 17;
    ctx.fillStyle = n % 2 ? '#8be2cf' : '#ffe69d';
    ctx.fillRect(x, y, hit + 2, n % 2 ? 3 : hit + 2);
  }
  ctx.restore();
}
