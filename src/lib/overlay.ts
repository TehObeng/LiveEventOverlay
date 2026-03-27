import { ScrollDirection } from './types';

export interface OverlayLaneState {
  lastEdge: number;
  lastTime: number;
  lastSpeed: number;
}

export function createOverlayLaneState(count: number): OverlayLaneState[] {
  return Array.from({ length: count }, () => ({
    lastEdge: 0,
    lastTime: 0,
    lastSpeed: 0,
  }));
}

export function isHorizontalDirection(direction: ScrollDirection) {
  return direction === 'rtl' || direction === 'ltr';
}

export function hexToRgba(hex: string, alpha: number) {
  try {
    return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;
  } catch {
    return 'transparent';
  }
}

export function getCenteredLanePosition(options: {
  lane: number;
  laneCount: number;
  fontSize: number;
  gapVertical: number;
  containerSize: number;
}) {
  const total = options.laneCount * options.fontSize + (options.laneCount - 1) * options.gapVertical;
  return Math.max(0, (options.containerSize - total) / 2) + options.lane * (options.fontSize + options.gapVertical);
}

export function pickRandomLane(count: number, isLaneClear: (laneIndex: number) => boolean) {
  const indices = Array.from({ length: count }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[randomIndex]] = [indices[randomIndex], indices[index]];
  }

  for (const laneIndex of indices) {
    if (isLaneClear(laneIndex)) {
      return laneIndex;
    }
  }

  return indices[0] ?? 0;
}
