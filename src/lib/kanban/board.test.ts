import { describe, expect, it } from "vitest";
import { addCard, createBoard, moveCard, removeCard } from "./board";
import type { Board, Card } from "./types";

const card = (id: string, title = `Card ${id}`): Card => ({ id, title });

describe("createBoard", () => {
  it("returns three empty columns: todo, doing, done", () => {
    const board = createBoard();
    expect(board.columns.map((c) => c.id)).toEqual(["todo", "doing", "done"]);
    expect(board.columns.every((c) => c.cards.length === 0)).toBe(true);
  });
});

describe("addCard", () => {
  it("appends a card to the matching column", () => {
    const next = addCard(createBoard(), "todo", card("c1"));
    expect(next.columns[0].cards).toEqual([card("c1")]);
    expect(next.columns[1].cards).toEqual([]);
  });

  it("does not mutate the original board", () => {
    const original = createBoard();
    addCard(original, "todo", card("c1"));
    expect(original.columns[0].cards).toEqual([]);
  });

  it("returns the board unchanged when column id is unknown", () => {
    const board = createBoard();
    const next = addCard(board, "missing", card("c1"));
    expect(next).toEqual(board);
  });
});

describe("removeCard", () => {
  it("removes the matching card from its column", () => {
    const board = addCard(createBoard(), "todo", card("c1"));
    const next = removeCard(board, "c1");
    expect(next.columns[0].cards).toEqual([]);
  });

  it("returns the board unchanged when card id is unknown", () => {
    const board = addCard(createBoard(), "todo", card("c1"));
    const next = removeCard(board, "missing");
    expect(next).toEqual(board);
  });
});

describe("moveCard", () => {
  const seed = (): Board => addCard(createBoard(), "todo", card("c1"));

  it("moves a card to the target column preserving its data", () => {
    const next = moveCard(seed(), "c1", "doing");
    expect(next.columns[0].cards).toEqual([]);
    expect(next.columns[1].cards).toEqual([card("c1")]);
  });

  it("returns the board unchanged when card id is unknown", () => {
    const board = seed();
    const next = moveCard(board, "missing", "doing");
    expect(next).toEqual(board);
  });

  it("returns the board unchanged when target column is unknown (card is not lost)", () => {
    const board = seed();
    const next = moveCard(board, "c1", "missing");
    expect(next).toEqual(board);
    expect(next.columns[0].cards).toEqual([card("c1")]);
  });
});
