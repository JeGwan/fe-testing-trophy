import type { Board as BoardModel } from "@/lib/kanban/types";

export function Board({ board }: { board: BoardModel }) {
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
        </section>
      ))}
    </div>
  );
}
