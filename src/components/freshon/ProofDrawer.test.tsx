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
  order_id: "FRSH-2FC946",
  weight_kg: 2.4,
  parcel_count: 2,
  notes: "Gate code 4421",
};

const draw = (stop: Stop) =>
  render(<ProofDrawer stop={stop} onClose={vi.fn()} onComplete={vi.fn()} />);

describe("ProofDrawer drop-off panel", () => {
  it("shows the parcel summary and note, never product names", () => {
    draw(base);
    // The rider is told order id + weight, never the contents.
    expect(screen.queryByText(/Mangoes/)).not.toBeInTheDocument();
    expect(screen.getByText(/Order FRSH-2FC946/)).toBeInTheDocument();
    expect(screen.getByText(/2\.4 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Gate code 4421/)).toBeInTheDocument();
  });

  it("shows the parcel weight at the hub pickup too", () => {
    draw({ ...base, type: "pickup" });
    expect(screen.getByText(/2\.4 kg/)).toBeInTheDocument();
    expect(screen.queryByText(/Mangoes/)).not.toBeInTheDocument();
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
