import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoolEmpty } from "./PoolEmpty";

describe("PoolEmpty", () => {
  it("says there is nothing to take when the rider is online", () => {
    render(<PoolEmpty online />);
    expect(screen.getByText(/no orders available at the moment/i)).toBeInTheDocument();
  });

  it("says the rider is offline, which is a different problem with a different fix", () => {
    // Being offline is something the rider fixes; an empty pool is something
    // they wait out. Showing one message for both left them doing neither.
    render(<PoolEmpty online={false} />);
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.getByText(/go online to start receiving orders/i)).toBeInTheDocument();
  });

  it("tells an online rider how to check again", () => {
    render(<PoolEmpty online />);
    expect(screen.getByText(/pull down to refresh/i)).toBeInTheDocument();
  });

  it("renders no radar or sweep — it implied a search that isn't happening", () => {
    const { container } = render(<PoolEmpty online />);
    expect(container.querySelector(".animate-radar")).toBeNull();
    expect(container.querySelector('[class*="animate-ping"]')).toBeNull();
  });
});
