/**
 * Which codes count: only those whose centre sits inside the square drawn on
 * the camera. expo-camera has no scan-region prop, so the position of each
 * detected code is checked here. Coordinates are in the camera view's space.
 */

export const FRAME_SIDE = 220;

type Point = { x: number; y: number };
export type Detected = {
  bounds?: { origin?: Point; size?: { width: number; height: number } };
  cornerPoints?: Point[];
};

const finite = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);

/** Centre of the code, or null when the camera gave no usable position. */
export function codeCentre({ bounds, cornerPoints }: Detected): Point | null {
  const pts = (cornerPoints ?? []).filter(finite);
  if (pts.length >= 3) {
    return {
      x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length,
      y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length,
    };
  }
  const { origin, size } = bounds ?? {};
  if (origin && size && finite(origin) && size.width > 0 && size.height > 0) {
    return { x: origin.x + size.width / 2, y: origin.y + size.height / 2 };
  }
  return null;
}

/** The square is centred in the view. A code with no position, or a view not measured yet, passes:
 *  better to scan than to go dead when the camera reports nothing to judge by. */
export function inFrame(
  detected: Detected,
  view: { width: number; height: number },
  side = FRAME_SIDE,
): boolean {
  const c = codeCentre(detected);
  if (!c || view.width <= 0 || view.height <= 0) return true;
  const half = side / 2;
  return Math.abs(c.x - view.width / 2) <= half && Math.abs(c.y - view.height / 2) <= half;
}
