import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProofDrawer } from "./ProofDrawer";
import type { Stop } from "@/lib/types";

vi.mock("@/lib/mapApps", () => ({ openInGoogleMaps: vi.fn() }));
const dialPhone = vi.fn();
vi.mock("@/lib/contact", () => ({
  dialPhone: (n: string) => dialPhone(n),
  SUPPORT_PHONE: "+91 80000 00000",
  toDialable: (p: string) => p.replace(/[^+\d]/g, ""),
}));

const base: Stop = {
  id: "s1",
  type: "dropoff",
  label: "Ananya Rao",
  address: "12, 100 Feet Rd, Indiranagar",
  customer: "Ananya Rao",
  eta: "9:40 AM",
  items: [{ name: "Mangoes", qty: 2, weight: "1000 g" }],
  notes: "Gate code 4421",
};

const draw = (stop: Stop) =>
  render(<ProofDrawer stop={stop} onClose={vi.fn()} onComplete={vi.fn()} />);

describe("ProofDrawer drop-off panel", () => {
  it("shows neither the item manifest nor the customer note", () => {
    draw(base);
    expect(screen.queryByText("Items")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mangoes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gate code/)).not.toBeInTheDocument();
  });

  it("still lists items at the hub pickup", () => {
    draw({ ...base, type: "pickup" });
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText(/Mangoes/)).toBeInTheDocument();
  });

  it("dials the customer through the system opener", () => {
    draw({ ...base, customer_phone: "+91 98450 11234" });
    screen.getByRole("button", { name: /call/i }).click();
    expect(dialPhone).toHaveBeenCalledWith("+91 98450 11234");
  });

  it("greys out Call when no number has been shared", () => {
    draw(base);
    expect(screen.getByText("Number not shared yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^call$/i })).not.toBeInTheDocument();
  });

  it("routes the proof CTA into the camera, never a file picker", () => {
    const { container } = draw(base);
    expect(screen.getByRole("button", { name: /start proof of delivery/i })).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});
