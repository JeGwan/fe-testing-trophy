import { Board } from "@/components/Board";
import { addCard, createBoard } from "@/lib/kanban/board";

export default function Home() {
  let board = createBoard();
  board = addCard(board, "todo", { id: "c1", title: "Buy milk" });
  board = addCard(board, "todo", { id: "c2", title: "Read RFC" });
  board = addCard(board, "doing", { id: "c3", title: "Write docs" });
  board = addCard(board, "done", { id: "c4", title: "Set up CI" });

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <h1 className="px-6 pt-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Kanban
      </h1>
      <Board board={board} />
    </main>
  );
}
