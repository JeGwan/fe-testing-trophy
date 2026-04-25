"use client";

import { useState } from "react";
import { addCard } from "@/lib/kanban/board";
import type {
  Board as BoardModel,
  ColumnId,
} from "@/lib/kanban/types";

export function Board({ initialBoard }: { initialBoard: BoardModel }) {
  const [board, setBoard] = useState(initialBoard);

  const handleAddCard = (columnId: ColumnId, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBoard((prev) =>
      addCard(prev, columnId, { id: crypto.randomUUID(), title: trimmed }),
    );
  };

  return (
    <div className="flex gap-4 p-6">
      {board.columns.map((column) => (
        <section
          key={column.id}
          aria-label={`${column.title} column`}
          className="flex w-72 flex-col gap-3 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            {column.title}
          </h2>
          <ul className="flex flex-col gap-2">
            {column.cards.map((card) => (
              <li
                key={card.id}
                className="rounded-md bg-white p-3 text-sm shadow-sm dark:bg-zinc-800"
              >
                {card.title}
              </li>
            ))}
          </ul>
          <AddCardForm onAdd={(title) => handleAddCard(column.id, title)} />
        </section>
      ))}
    </div>
  );
}

function AddCardForm({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const close = () => {
    setTitle("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-zinc-300 p-2 text-sm text-zinc-600 hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        + Add card
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(title);
        close();
      }}
      className="flex flex-col gap-2"
    >
      <input
        autoFocus
        aria-label="New card title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add
        </button>
        <button
          type="button"
          onClick={close}
          className="rounded-md px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
