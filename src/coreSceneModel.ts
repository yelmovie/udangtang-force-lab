export type CoreRoute = 'short' | 'long';
export type CorePoint = { x: number; y: number; z: number };
export const coreRoutes: Record<CoreRoute, { start: CorePoint; end: CorePoint }> = {
  long: { start: { x: -4.5, y: .08, z: 1.25 }, end: { x: 1.5, y: 1.3, z: 1.25 } },
  short: { start: { x: -1.2, y: .08, z: -1.25 }, end: { x: 1.5, y: 1.3, z: -1.25 } },
};
export function coreRoutePoint(route: CoreRoute, progress: number): CorePoint {
  const { start, end } = coreRoutes[route];
  const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: start.z };
}
// Project a touch movement onto the visible route; sideward motion is not progress.
export function coreDragProgress(delta: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x, dy = end.y - start.y, length = dx * dx + dy * dy;
  if (!length || !Number.isFinite(delta.x + delta.y + length)) return 0;
  return (delta.x * dx + delta.y * dy) / length;
}
