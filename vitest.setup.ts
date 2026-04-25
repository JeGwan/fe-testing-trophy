import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest defaults to globals: false, so RTL cannot auto-register
// its cleanup hook. Register it explicitly to unmount mounted trees
// between tests.
afterEach(() => {
  cleanup();
});
