export const COMPANION_STORAGE_KEY = "codex-webui-companion-v1";
export const COMPANION_SIZE = { width: 128, height: 154 };
const EDGE = 8;

export interface Point { x: number; y: number }
export interface Viewport { width: number; height: number }
export interface CompanionPreferences { position: Point | null; hidden: boolean }
export interface CompanionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEFAULT_PREFERENCES: CompanionPreferences = { position: null, hidden: false };
const isCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 10_000_000;

export function clampPosition(point: Point, viewport: Viewport): Point {
  const width = Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : 0;
  const height = Number.isFinite(viewport.height) ? Math.max(0, viewport.height) : 0;
  const insetX = Math.min(EDGE, width / 2);
  const insetY = Math.min(EDGE, height / 2);
  const maxX = Math.max(insetX, width - Math.min(COMPANION_SIZE.width, width - insetX * 2) - insetX);
  const maxY = Math.max(insetY, height - Math.min(COMPANION_SIZE.height, height - insetY * 2) - insetY);
  return {
    x: Math.min(maxX, Math.max(insetX, isCoordinate(point.x) ? point.x : insetX)),
    y: Math.min(maxY, Math.max(insetY, isCoordinate(point.y) ? point.y : insetY)),
  };
}

export function defaultPosition(viewport: Viewport): Point {
  return clampPosition({ x: viewport.width - COMPANION_SIZE.width - 20, y: 88 }, viewport);
}

export function readCompanionPreferences(storage: CompanionStorage | null): CompanionPreferences {
  try {
    const raw = storage?.getItem(COMPANION_STORAGE_KEY);
    if (!raw || raw.length > 2048) return { ...DEFAULT_PREFERENCES };
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return { ...DEFAULT_PREFERENCES };
    const record = value as Record<string, unknown>;
    if (record.version !== 1) return { ...DEFAULT_PREFERENCES };
    const point = record.position as Record<string, unknown> | null;
    const position = point && isCoordinate(point.x) && isCoordinate(point.y)
      ? { x: point.x, y: point.y } : null;
    return { position, hidden: record.hidden === true };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writeCompanionPreferences(
  storage: CompanionStorage | null,
  preferences: CompanionPreferences,
): void {
  try {
    storage?.setItem(COMPANION_STORAGE_KEY, JSON.stringify({ version: 1, ...preferences }));
  } catch {
    // Storage may be disabled or full; the companion still works for this visit.
  }
}

export type SpriteVersion = 1 | 2;
export const MAX_SPRITE_BYTES = 20 * 1024 * 1024;

export function spriteVersion(width: number, height: number): SpriteVersion | null {
  if (width !== 1536) return null;
  return height === 1872 ? 1 : height === 2288 ? 2 : null;
}
