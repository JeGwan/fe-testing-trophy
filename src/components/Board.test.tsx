import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Board } from "./Board";
import { addCard, createBoard } from "@/lib/kanban/board";
import {
  BOARD_STORAGE_KEY,
  deserializeBoard,
  saveBoard,
} from "@/lib/kanban/storage";

describe("<Board /> static rendering", () => {
  it("renders three column headings: Todo / Doing / Done", () => {
    render(<Board initialBoard={createBoard()} />);
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
    render(<Board initialBoard={board} />);

    const todo = screen.getByRole("region", { name: "Todo column" });
    const doing = screen.getByRole("region", { name: "Doing column" });

    expect(within(todo).getByText("Buy milk")).toBeInTheDocument();
    expect(within(todo).queryByText("Write docs")).toBeNull();
    expect(within(doing).getByText("Write docs")).toBeInTheDocument();
  });

  it("renders an empty column with no cards", () => {
    render(<Board initialBoard={createBoard()} />);
    const done = screen.getByRole("region", { name: "Done column" });
    expect(within(done).queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("<Board /> add card interaction", () => {
  it("opens an input when '+ Add card' is clicked, then adds a typed card to that column", async () => {
    const user = userEvent.setup();
    render(<Board initialBoard={createBoard()} />);

    const todo = screen.getByRole("region", { name: "Todo column" });
    await user.click(within(todo).getByRole("button", { name: /add card/i }));

    const input = within(todo).getByRole("textbox", {
      name: /new card title/i,
    });
    await user.type(input, "Buy milk");
    await user.click(within(todo).getByRole("button", { name: "Add" }));

    expect(within(todo).getByText("Buy milk")).toBeInTheDocument();
  });

  it("adds the card only to the column whose form was used", async () => {
    const user = userEvent.setup();
    render(<Board initialBoard={createBoard()} />);

    const doing = screen.getByRole("region", { name: "Doing column" });
    const todo = screen.getByRole("region", { name: "Todo column" });

    await user.click(
      within(doing).getByRole("button", { name: /add card/i }),
    );
    await user.type(
      within(doing).getByRole("textbox", { name: /new card title/i }),
      "Write docs",
    );
    await user.click(within(doing).getByRole("button", { name: "Add" }));

    expect(within(doing).getByText("Write docs")).toBeInTheDocument();
    expect(within(todo).queryByText("Write docs")).toBeNull();
  });

  it("does not add a card when submitted with whitespace-only input", async () => {
    const user = userEvent.setup();
    render(<Board initialBoard={createBoard()} />);

    const todo = screen.getByRole("region", { name: "Todo column" });
    await user.click(within(todo).getByRole("button", { name: /add card/i }));

    const input = within(todo).getByRole("textbox", {
      name: /new card title/i,
    });
    await user.type(input, "   ");
    await user.keyboard("{Enter}");

    expect(within(todo).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("Cancel closes the form without adding a card", async () => {
    const user = userEvent.setup();
    render(<Board initialBoard={createBoard()} />);

    const todo = screen.getByRole("region", { name: "Todo column" });
    await user.click(within(todo).getByRole("button", { name: /add card/i }));
    await user.type(
      within(todo).getByRole("textbox", { name: /new card title/i }),
      "draft",
    );
    await user.click(within(todo).getByRole("button", { name: "Cancel" }));

    expect(within(todo).queryByText("draft")).toBeNull();
    expect(
      within(todo).getByRole("button", { name: /add card/i }),
    ).toBeInTheDocument();
  });
});

describe("<Board /> persistence", () => {
  it("loads stored board on mount, overriding initialBoard", async () => {
    const stored = addCard(createBoard(), "doing", {
      id: "stored-1",
      title: "Restored task",
    });
    saveBoard(localStorage, stored);

    render(<Board initialBoard={createBoard()} />);

    const doing = await screen.findByRole("region", { name: "Doing column" });
    expect(
      await within(doing).findByText("Restored task"),
    ).toBeInTheDocument();
  });

  it("persists added cards to localStorage", async () => {
    const user = userEvent.setup();
    render(<Board initialBoard={createBoard()} />);

    const todo = screen.getByRole("region", { name: "Todo column" });
    await user.click(within(todo).getByRole("button", { name: /add card/i }));
    await user.type(
      within(todo).getByRole("textbox", { name: /new card title/i }),
      "Persist me",
    );
    await user.click(within(todo).getByRole("button", { name: "Add" }));

    const persisted = deserializeBoard(localStorage.getItem(BOARD_STORAGE_KEY));
    expect(persisted).not.toBeNull();
    const todoColumn = persisted!.columns.find((c) => c.id === "todo");
    expect(todoColumn?.cards.map((c) => c.title)).toContain("Persist me");
  });

  it("falls back to initialBoard when storage holds corrupted data", async () => {
    localStorage.setItem(BOARD_STORAGE_KEY, "{not json");
    const seed = addCard(createBoard(), "todo", {
      id: "seed-1",
      title: "Seeded",
    });

    render(<Board initialBoard={seed} />);

    const todo = screen.getByRole("region", { name: "Todo column" });
    expect(within(todo).getByText("Seeded")).toBeInTheDocument();
  });
});
