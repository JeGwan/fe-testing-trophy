import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Board } from "./Board";
import { addCard, createBoard } from "@/lib/kanban/board";

describe("<Board />", () => {
  it("renders three column headings: Todo / Doing / Done", () => {
    render(<Board board={createBoard()} />);
    expect(
      screen.getByRole("heading", { name: "Todo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Doing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Done" }),
    ).toBeInTheDocument();
  });

  it("places each card inside the column it belongs to", () => {
    let board = createBoard();
    board = addCard(board, "todo", { id: "c1", title: "Buy milk" });
    board = addCard(board, "doing", { id: "c2", title: "Write docs" });
    render(<Board board={board} />);

    const todo = screen.getByRole("region", { name: "Todo column" });
    const doing = screen.getByRole("region", { name: "Doing column" });

    expect(within(todo).getByText("Buy milk")).toBeInTheDocument();
    expect(within(todo).queryByText("Write docs")).toBeNull();
    expect(within(doing).getByText("Write docs")).toBeInTheDocument();
  });

  it("renders an empty column with no cards", () => {
    render(<Board board={createBoard()} />);
    const done = screen.getByRole("region", { name: "Done column" });
    expect(within(done).queryAllByRole("listitem")).toHaveLength(0);
  });
});
