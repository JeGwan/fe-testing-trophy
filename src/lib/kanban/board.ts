import type { Board, Card, CardId, ColumnId } from "./types";

export function createBoard(): Board {
  return {
    columns: [
      { id: "todo", title: "Todo", cards: [] },
      { id: "doing", title: "Doing", cards: [] },
      { id: "done", title: "Done", cards: [] },
    ],
  };
}

export function addCard(
  board: Board,
  columnId: ColumnId,
  card: Card,
): Board {
  if (!board.columns.some((c) => c.id === columnId)) return board;
  return {
    ...board,
    columns: board.columns.map((col) =>
      col.id === columnId ? { ...col, cards: [...col.cards, card] } : col,
    ),
  };
}

export function removeCard(board: Board, cardId: CardId): Board {
  if (!findCard(board, cardId)) return board;
  return {
    ...board,
    columns: board.columns.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => c.id !== cardId),
    })),
  };
}

export function moveCard(
  board: Board,
  cardId: CardId,
  targetColumnId: ColumnId,
): Board {
  const card = findCard(board, cardId);
  if (!card) return board;
  if (!board.columns.some((c) => c.id === targetColumnId)) return board;
  return addCard(removeCard(board, cardId), targetColumnId, card);
}

function findCard(board: Board, cardId: CardId): Card | undefined {
  for (const col of board.columns) {
    const found = col.cards.find((c) => c.id === cardId);
    if (found) return found;
  }
  return undefined;
}
