import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Says the quiet part out loud: the phone has no network.
 *
 * Without this, a rider in a lift lobby taps Complete, watches it fail, and has
 * no way to tell whether the app is broken, the delivery was refused, or they
 * simply have no bars. The wording is deliberately about the phone rather than
 * the app — "no connection" is something the rider can act on by walking a few
 * metres; "something went wrong" is not.
 *
 * Sits under the status bar rather than over the content, because covering the
 * screen of someone standing at a customer's door is its own problem.
 */
export const OfflineBanner = () => {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-secondary px-4 py-2 text-secondary-foreground"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-xs font-bold">No connection — your work is saved on this phone</span>
    </div>
  );
};
