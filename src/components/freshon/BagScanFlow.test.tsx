import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BagScanFlow } from "./BagScanFlow";
import type { DeliveryTrip, TripStop } from "@/lib/deliveryTripService";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const stop = (n: number, scanned: boolean): TripStop => ({
  id: `s${n}`,
  type: "dropoff",
  label: `Customer ${n}`,
  address: `${n} Main Rd`,
  latitude: 12.9,
  longitude: 77.6,
  sequence: n,
  is_completed: false,
  bag_scanned: scanned,
  assignment: `a${n}`,
});

const trip = (scannedCount: number): DeliveryTrip => ({
  id: "t1",
  status: "ASSIGNED",
  total_distance_km: 8,
  total_duration_min: 25,
  stop_count: 2,
  encoded_polyline: "",
  is_optimized: true,
  hub: null,
  stops: [stop(1, scannedCount > 0), stop(2, scannedCount > 1)],
});

describe("BagScanFlow hub handover", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not confirm while a bag is still unscanned", () => {
    const onAllScanned = vi.fn();
    render(<BagScanFlow trip={trip(1)} onTripUpdate={vi.fn()} onAllScanned={onAllScanned} />);

    expect(onAllScanned).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /scan last bag/i })).toBeInTheDocument();
  });

  it("treats the last scan as the confirmation — no confirm button", async () => {
    const onAllScanned = vi.fn().mockResolvedValue(undefined);
    render(<BagScanFlow trip={trip(2)} onTripUpdate={vi.fn()} onAllScanned={onAllScanned} />);

    await waitFor(() => expect(onAllScanned).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /confirm hub pickup/i })).not.toBeInTheDocument();
  });

  it("offers a retry only when the auto-confirm fails", async () => {
    // Resolving without the trip leaving ASSIGNED means the confirm was rejected.
    const onAllScanned = vi.fn().mockResolvedValue(undefined);
    render(<BagScanFlow trip={trip(2)} onTripUpdate={vi.fn()} onAllScanned={onAllScanned} />);

    const retry = await screen.findByRole("button", { name: /retry hub handover/i });
    fireEvent.click(retry);
    await waitFor(() => expect(onAllScanned).toHaveBeenCalledTimes(2));
  });
});
