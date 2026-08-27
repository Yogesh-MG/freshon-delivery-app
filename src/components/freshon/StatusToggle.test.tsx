import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusToggle } from "./StatusToggle";

const noop = () => undefined;

describe("StatusToggle", () => {
  it("labels the wait by where it is heading, not where it still is", () => {
    // The whole permissions-and-GPS stretch of going online runs before
    // `online` flips, and labelling by the current value told a rider who had
    // just tapped Go Online that they were "Going offline…".
    render(<StatusToggle online={false} pending target={true} onChange={noop} />);
    expect(screen.getByText(/going online/i)).toBeInTheDocument();
    expect(screen.queryByText(/going offline/i)).toBeNull();
  });

  it("switches to the setup phase once the status write has landed", () => {
    // Same transition, later phase: `online` has flipped, the dashboard fetch
    // is what's left.
    render(<StatusToggle online pending target={true} onChange={noop} />);
    expect(screen.getByText(/getting you set up/i)).toBeInTheDocument();
  });

  it("still says going offline when that is the actual direction", () => {
    render(<StatusToggle online pending target={false} onChange={noop} />);
    expect(screen.getByText(/going offline/i)).toBeInTheDocument();
  });

  it("labels the resting states by the current value alone", () => {
    const { rerender } = render(<StatusToggle online={false} onChange={noop} />);
    expect(screen.getByText(/tap to go online/i)).toBeInTheDocument();
    rerender(<StatusToggle online onChange={noop} />);
    expect(screen.getByText(/you're on the grid/i)).toBeInTheDocument();
  });
});
