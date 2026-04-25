export type CardId = string;
export type ColumnId = string;

export type Card = {
  id: CardId;
  title: string;
};

export type Column = {
  id: ColumnId;
  title: string;
  cards: Card[];
};

export type Board = {
  columns: Column[];
};
