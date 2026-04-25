import { describe, expect, it } from "vitest";
import { addCard, createBoard } from "./board";
import {
  BOARD_STORAGE_KEY,
  deserializeBoard,
  loadBoard,
  saveBoard,
  serializeBoard,
} from "./storage";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe("storage", () => {
  it("round-trips a board through serialize/deserialize", () => {
    const board = addCard(createBoard(), "todo", {
      id: "c1",
      title: "Buy milk",
    });
    expect(deserializeBoard(serializeBoard(board))).toEqual(board);
  });

  it("save then load returns an equal board", () => {
    const storage = makeStorage();
    const board = addCard(createBoard(), "todo", {
      id: "c1",
      title: "Buy milk",
    });
    saveBoard(storage, board);
    expect(loadBoard(storage)).toEqual(board);
  });

  it("loadBoard returns null when storage is empty", () => {
    expect(loadBoard(makeStorage())).toBeNull();
  });

  it("deserializeBoard returns null on malformed JSON", () => {
    expect(deserializeBoard("{not json")).toBeNull();
  });

  it("deserializeBoard returns null on shape mismatch", () => {
    expect(deserializeBoard('{"foo":"bar"}')).toBeNull();
    expect(
      deserializeBoard('{"columns":[{"id":1,"title":"x","cards":[]}]}'),
    ).toBeNull();
    expect(
      deserializeBoard(
        '{"columns":[{"id":"todo","title":"Todo","cards":[{"id":"c1"}]}]}',
      ),
    ).toBeNull();
  });

  it("uses BOARD_STORAGE_KEY by default", () => {
    const storage = makeStorage();
    saveBoard(storage, createBoard());
    expect(storage.getItem(BOARD_STORAGE_KEY)).not.toBeNull();
  });
});
