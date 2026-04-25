import type { Board } from "./types";

export const BOARD_STORAGE_KEY = "kanban-board-v1";

export function serializeBoard(board: Board): string {
  return JSON.stringify(board);
}

export function deserializeBoard(raw: string | null): Board | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidBoard(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadBoard(
  storage: Storage,
  key: string = BOARD_STORAGE_KEY,
): Board | null {
  return deserializeBoard(storage.getItem(key));
}

export function saveBoard(
  storage: Storage,
  board: Board,
  key: string = BOARD_STORAGE_KEY,
): void {
  storage.setItem(key, serializeBoard(board));
}

function isValidBoard(value: unknown): value is Board {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { columns?: unknown };
  if (!Array.isArray(candidate.columns)) return false;
  return candidate.columns.every(isValidColumn);
}

function isValidColumn(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const c = value as { id?: unknown; title?: unknown; cards?: unknown };
  if (typeof c.id !== "string") return false;
  if (typeof c.title !== "string") return false;
  if (!Array.isArray(c.cards)) return false;
  return c.cards.every(isValidCard);
}

function isValidCard(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const c = value as { id?: unknown; title?: unknown };
  return typeof c.id === "string" && typeof c.title === "string";
}
