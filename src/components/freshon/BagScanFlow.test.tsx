import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { BagScanFlow } from "./BagScanFlow";
import type { DeliveryTrip, TripStop } from "@/lib/deliveryTripService";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The scanner is a camera surface; drive it through its manual-entry path so a
// test can type the code a rider would scan.
vi.mock("./QrScanner", () => ({
  QrScanner: ({ onScan }: { onScan: (text: string) => void }) => (
    <input aria-label="scan" onChange={(e) => onScan(e.target.value)} />
  ),
}));

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
  order_id: `FRSH-A434E${n}`,
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

/** Opens the scanner on the next outstanding bag and feeds it a code. */
const scan = (code: string) => {
  // The main CTA, not the per-row "Scan bag for …" buttons.
  fireEvent.click(screen.getByRole("button", { name: /scan (bag \d+ of|last bag)/i }));
  fireEvent.change(screen.getByLabelText("scan"), { target: { value: code } });
};

describe("BagScanFlow hub handover", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not confirm while a bag is still unscanned", () => {
    const onAllScanned = vi.fn();
    render(<BagScanFlow trip={trip(1)} onAllScanned={onAllScanned} />);

    expect(onAllScanned).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /scan last bag/i })).toBeInTheDocument();
  });

  it("treats the last scan as the confirmation — no confirm button", async () => {
    const onAllScanned = vi.fn().mockResolvedValue(undefined);
    render(<BagScanFlow trip={trip(2)} onAllScanned={onAllScanned} />);

    await waitFor(() => expect(onAllScanned).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /confirm hub pickup/i })).not.toBeInTheDocument();
  });

  it("offers a retry only when the auto-confirm fails", async () => {
    // Resolving without the trip leaving ASSIGNED means the confirm was rejected.
    const onAllScanned = vi.fn().mockResolvedValue(undefined);
    render(<BagScanFlow trip={trip(2)} onAllScanned={onAllScanned} />);

    const retry = await screen.findByRole("button", { name: /retry hub handover/i });
    fireEvent.click(retry);
    await waitFor(() => expect(onAllScanned).toHaveBeenCalledTimes(2));
  });

  it("counts a bag whose code is the order id behind a D- prefix", () => {
    render(<BagScanFlow trip={trip(0)} onAllScanned={vi.fn()} />);

    scan("D-FRSH-A434E1-1");
    expect(screen.getByText("1 / 2 bags scanned")).toBeInTheDocument();
  });

  it("counts the bare-suffix spelling the printed codes also use", () => {
    render(<BagScanFlow trip={trip(0)} onAllScanned={vi.fn()} />);

    // D-A434E1-1 and D-FRSH-A434E1-1 are the same bag; the server assumes the
    // FRSH- prefix when a code carries only the suffix.
    scan("D-A434E1-1");
    expect(screen.getByText("1 / 2 bags scanned")).toBeInTheDocument();
  });

  it("sends a bag index even when the scanned code carries none", async () => {
    // Regression: the live API reads the last segment as the bag index, so a
    // bare D-FRSH-A434E1 previously resolved to FRSH-FRSH and handover was refused.
    // The scan is accepted — it is a real bag — and it goes out as bag 1.
    const onAllScanned = vi.fn().mockResolvedValue(undefined);
    render(<BagScanFlow trip={trip(1)} onAllScanned={onAllScanned} />);

    scan("D-FRSH-A434E2");
    await waitFor(() =>
      expect(onAllScanned).toHaveBeenCalledWith([
        { stop_id: "s2", order_id: "FRSH-A434E2", code: "D-FRSH-A434E2-1" },
      ]),
    );
  });

  it("correctly matches order codes like D-FRSH-AE2CB8 without resolving to FRSH-FRSH", () => {
    render(<BagScanFlow trip={trip(0)} onAllScanned={vi.fn()} />);

    scan("D-FRSH-A434E1");
    expect(screen.getByText("1 / 2 bags scanned")).toBeInTheDocument();
  });

  it("accepts a lowercase manually-typed code", () => {
    render(<BagScanFlow trip={trip(0)} onAllScanned={vi.fn()} />);

    scan("d-frsh-a434e1-1");
    expect(screen.getByText("1 / 2 bags scanned")).toBeInTheDocument();
  });

  it("refuses a code with no D- prefix", () => {
    render(<BagScanFlow trip={trip(0)} onAllScanned={vi.fn()} />);

    scan("FRSH-A434E1-1");
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/not a bag code/i));
    expect(screen.getByText("0 / 2 bags scanned")).toBeInTheDocument();
  });

  it("refuses a bag belonging to another trip", () => {
    render(<BagScanFlow trip={trip(0)} onAllScanned={vi.fn()} />);

    scan("D-FRSH-ZZZZZZ-1");
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/isn't on this trip/i));
    expect(screen.getByText("0 / 2 bags scanned")).toBeInTheDocument();
  });

  it("refuses the same bag twice rather than counting it as two", () => {
    render(<BagScanFlow trip={trip(0)} onAllScanned={vi.fn()} />);

    scan("D-FRSH-A434E1-1");
    scan("D-FRSH-A434E1-1");
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/already scanned/i));
    expect(screen.getByText("1 / 2 bags scanned")).toBeInTheDocument();
  });

  it("reports every scanned code once the last bag matches", async () => {
    const onAllScanned = vi.fn().mockResolvedValue(undefined);
    render(<BagScanFlow trip={trip(0)} onAllScanned={onAllScanned} />);

    scan("D-FRSH-A434E1-1");
    scan("D-FRSH-A434E2-1");

    await waitFor(() =>
      expect(onAllScanned).toHaveBeenCalledWith([
        { stop_id: "s1", order_id: "FRSH-A434E1", code: "D-FRSH-A434E1-1" },
        { stop_id: "s2", order_id: "FRSH-A434E2", code: "D-FRSH-A434E2-1" },
      ]),
    );
  });

  it("matches on the code, not on the row the rider tapped", async () => {
    const onAllScanned = vi.fn().mockResolvedValue(undefined);
    render(<BagScanFlow trip={trip(0)} onAllScanned={onAllScanned} />);

    // Scanner opens on stop 1; the bag in hand is stop 2's.
    scan("D-FRSH-A434E2-1");
    expect(screen.getByText("1 / 2 bags scanned")).toBeInTheDocument();

    scan("D-FRSH-A434E1-1");
    await waitFor(() =>
      expect(onAllScanned).toHaveBeenCalledWith([
        { stop_id: "s2", order_id: "FRSH-A434E2", code: "D-FRSH-A434E2-1" },
        { stop_id: "s1", order_id: "FRSH-A434E1", code: "D-FRSH-A434E1-1" },
      ]),
    );
  });
});
