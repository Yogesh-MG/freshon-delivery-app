import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Stop } from "@/lib/types";
import { resetOtpSessions } from "@/lib/otpSession";
import type { ProofSubmission } from "./ProofDrawer";

vi.mock("@/lib/mapApps", () => ({ openInGoogleMaps: vi.fn() }));
vi.mock("@/lib/contact", () => ({
  dialPhone: vi.fn(),
  SUPPORT_PHONE: "+91 80000 00000",
  toDialable: (p: string) => p.replace(/[^+\d]/g, ""),
}));

/**
 * The real camera needs getUserMedia and a canvas, neither of which jsdom has.
 * Step 1 is stood in for by a button that hands back the same thing a real
 * capture does — a File and its provenance — so the tests can reach step 2,
 * which is where the OTP, the cash and the failure handling live.
 */
vi.mock("./CameraCapture", () => ({
  CameraCapture: ({ onCapture }: { onCapture: (file: File, meta: unknown) => void }) => (
    <button
      onClick={() =>
        onCapture(new File(["x"], "proof.jpg", { type: "image/jpeg" }), {
          capturedAt: "2026-08-11T09:15:00.000Z",
          latitude: 12.9,
          longitude: 77.6,
          accuracy: 10,
        })
      }
    >
      capture-stub
    </button>
  ),
}));

const { ProofDrawer } = await import("./ProofDrawer");

const base: Stop = {
  id: "s1",
  type: "dropoff",
  label: "Ananya Rao",
  address: "12, 100 Feet Rd, Indiranagar",
  customer: "Ananya Rao",
  eta: "9:40 AM",
  order_id: "FRSH-2FC946",
  latitude: 12.9,
  longitude: 77.6,
};

const onComplete = vi.fn();
const onResend = vi.fn();

/** Render and walk to step 2, which is where everything under test happens. */
const openOtpStep = async (stop: Stop = base) => {
  const view = render(
    <ProofDrawer stop={stop} onClose={vi.fn()} onComplete={onComplete} onResend={onResend} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /start proof of delivery/i }));
  fireEvent.click(await screen.findByText("capture-stub"));
  await screen.findByText(/enter the 6-digit code/i);
  return view;
};

const otpBoxes = () =>
  screen.getAllByRole("textbox", { hidden: true }).filter((el) => (el as HTMLInputElement).maxLength === 1);

const typeOtp = (code: string) => {
  fireEvent.change(otpBoxes()[0], { target: { value: code } });
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: /verify & complete/i }));

const lastSubmission = (): ProofSubmission => onComplete.mock.calls.at(-1)![1];

beforeEach(() => {
  onComplete.mockReset();
  onComplete.mockResolvedValue(true);
  onResend.mockReset();
  onResend.mockResolvedValue(undefined);
  // Cooldowns and attempt counts deliberately outlive the component, so they
  // outlive a test too unless cleared.
  resetOtpSessions();
});

describe("OTP entry", () => {
  it("spreads a pasted code across every box", async () => {
    // maxLength caps typing, not a paste — the old handler kept the first digit
    // and dropped the rest, which read as the paste being ignored.
    await openOtpStep();
    fireEvent.paste(otpBoxes()[0], { clipboardData: { getData: () => "483921" } });

    expect(otpBoxes().map((el) => (el as HTMLInputElement).value)).toEqual(
      ["4", "8", "3", "9", "2", "1"],
    );
  });

  it("spreads an autofilled code the same way", async () => {
    await openOtpStep();
    typeOtp("483921");
    expect(otpBoxes().map((el) => (el as HTMLInputElement).value).join("")).toBe("483921");
  });

  it("lands a whole code at the start whichever box it was pasted into", async () => {
    // Pasting six digits into box 4 kept two and silently dropped four.
    await openOtpStep();
    fireEvent.paste(otpBoxes()[3], { clipboardData: { getData: () => "483921" } });

    expect(otpBoxes().map((el) => (el as HTMLInputElement).value).join("")).toBe("483921");
  });

  it("still fills forward from the caret for a partial paste", async () => {
    await openOtpStep();
    fireEvent.paste(otpBoxes()[2], { clipboardData: { getData: () => "92" } });

    expect(otpBoxes().map((el) => (el as HTMLInputElement).value).join("")).toBe("92");
    expect((otpBoxes()[2] as HTMLInputElement).value).toBe("9");
  });

  it("sends the code with the photo that was captured for it", async () => {
    await openOtpStep();
    typeOtp("483921");
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(lastSubmission()).toMatchObject({
      type: "otp",
      otpCode: "483921",
      photoMeta: { capturedAt: "2026-08-11T09:15:00.000Z", latitude: 12.9 },
    });
    expect(lastSubmission().photo).toBeInstanceOf(File);
  });
});

describe("a refused delivery", () => {
  it("keeps the reason on screen instead of a toast that vanishes", async () => {
    onComplete.mockResolvedValue({
      ok: false,
      error: "Incorrect OTP. Ask the customer to read the code again.",
      failure: "otp",
    });
    await openOtpStep();
    typeOtp("111111");
    submit();

    expect(await screen.findByText(/incorrect otp/i)).toBeInTheDocument();
    // …and what to do about it.
    expect(screen.getByText(/or resend it/i)).toBeInTheDocument();
  });

  it("clears the boxes after a rejected code so the rider can just retype", async () => {
    onComplete.mockResolvedValue({ ok: false, error: "Invalid code", failure: "otp" });
    await openOtpStep();
    typeOtp("111111");
    submit();

    await waitFor(() =>
      expect(otpBoxes().map((el) => (el as HTMLInputElement).value).join("")).toBe(""),
    );
  });

  it("leaves the code alone when the refusal was about where the rider is", async () => {
    // Retyping a code that was never the problem is pure friction.
    onComplete.mockResolvedValue({
      ok: false,
      error: "You are too far from the delivery address",
      failure: "location",
    });
    await openOtpStep();
    typeOtp("483921");
    submit();

    expect(await screen.findByText(/too far/i)).toBeInTheDocument();
    expect(otpBoxes().map((el) => (el as HTMLInputElement).value).join("")).toBe("483921");
    expect(screen.getByText(/move closer/i)).toBeInTheDocument();
  });

  it("classifies the failure itself when the caller only sends a message", async () => {
    onComplete.mockResolvedValue({ ok: false, error: "Incorrect OTP" });
    await openOtpStep();
    typeOtp("111111");
    submit();

    await waitFor(() =>
      expect(otpBoxes().map((el) => (el as HTMLInputElement).value).join("")).toBe(""),
    );
  });
});

describe("resending the code", () => {
  it("locks the button for a spell so the SMS gateway isn't machine-gunned", async () => {
    await openOtpStep();
    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));

    await waitFor(() => expect(onResend).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /resend in \d+s/i })).toBeDisabled();
  });

  it("empties the boxes, because the code the rider half-typed is now stale", async () => {
    await openOtpStep();
    typeOtp("111111");
    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));

    await waitFor(() =>
      expect(otpBoxes().map((el) => (el as HTMLInputElement).value).join("")).toBe(""),
    );
  });

  it("holds the lock when the rider closes the sheet and comes back", async () => {
    // The cooldown belongs to the code, not to this sheet. Reopening used to
    // reset it, which made the lock trivially skippable.
    const view = await openOtpStep();
    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));
    await screen.findByRole("button", { name: /resend in \d+s/i });

    view.unmount();
    await openOtpStep();

    expect(await screen.findByRole("button", { name: /resend in \d+s/i })).toBeDisabled();
  });
});

describe("cash on delivery", () => {
  it("names the amount to collect and blocks completion until it's confirmed", async () => {
    await openOtpStep({ ...base, cod_amount: 640 });
    typeOtp("483921");

    expect(screen.getByText(/collect ₹640/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify & complete/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /verify & complete/i })).toBeEnabled();
  });

  it("reports how much was taken, not just that cash changed hands", async () => {
    await openOtpStep({ ...base, cod_amount: "640.00" });
    typeOtp("483921");
    fireEvent.click(screen.getByRole("checkbox"));
    submit();

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(lastSubmission()).toMatchObject({ codCollected: true, codAmount: 640 });
  });

  it("never asks a prepaid customer for cash", async () => {
    // The tick used to appear on every door, including the ones with nothing due.
    await openOtpStep({ ...base, cod_amount: null });
    expect(screen.getByText(/prepaid/i)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps the old tick where the backend doesn't send the field yet", async () => {
    // Dropping it outright would take away the rider's only way to record cash.
    await openOtpStep(base);
    expect(screen.getByText(/cash on delivery collected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify & complete/i })).toBeDisabled();
    typeOtp("483921");
    expect(screen.getByRole("button", { name: /verify & complete/i })).toBeEnabled();
  });
});

describe("the no-code fallback", () => {
  const failTwice = async () => {
    onComplete.mockResolvedValue({ ok: false, error: "Incorrect OTP", failure: "otp" });
    const view = await openOtpStep();
    for (let i = 0; i < 2; i++) {
      typeOtp("111111");
      submit();
      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(i + 1));
    }
    return view;
  };

  it("stays hidden while the rider hasn't tried yet", async () => {
    await openOtpStep();
    expect(screen.queryByText(/can't receive the code/i)).not.toBeInTheDocument();
  });

  it("appears once the code has genuinely failed", async () => {
    await failTwice();
    expect(await screen.findByText(/can't receive the code/i)).toBeInTheDocument();
  });

  it("is not unlocked by failures that had nothing to do with the code", async () => {
    // Being too far from the drop says nothing about whether the customer can
    // read out a code, so it must not push the rider towards the fallback.
    onComplete.mockResolvedValue({ ok: false, error: "Too far from the drop", failure: "location" });
    await openOtpStep();
    for (let i = 0; i < 3; i++) {
      typeOtp("483921");
      submit();
      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(i + 1));
    }
    expect(screen.queryByText(/can't receive the code/i)).not.toBeInTheDocument();
  });

  it("remembers earlier attempts after the rider closes and reopens the sheet", async () => {
    const view = await failTwice();
    screen.getByText(/can't receive the code/i);

    // Reopening used to wipe the count and hide the fallback again.
    view.unmount();
    await openOtpStep();

    expect(await screen.findByText(/can't receive the code/i)).toBeInTheDocument();
  });

  it("asks a second time before closing a stop the customer never confirmed", async () => {
    await failTwice();
    fireEvent.click(screen.getByText(/can't receive the code/i));

    expect(screen.getByText(/flags it for review/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete without code/i })).toBeInTheDocument();
  });

  it("submits as a flagged photo delivery, not as a normal one", async () => {
    await failTwice();
    onComplete.mockResolvedValue(true);
    fireEvent.click(screen.getByText(/can't receive the code/i));
    fireEvent.click(screen.getByRole("button", { name: /complete without code/i }));

    await waitFor(() => expect(lastSubmission().type).toBe("photo"));
    expect(lastSubmission()).toMatchObject({ exceptionReason: "OTP_UNAVAILABLE" });
    expect(lastSubmission().photo).toBeInstanceOf(File);
  });
});
