import { useEffect, useState } from "react";

/**
 * Whether the device thinks it has a network.
 *
 * The app had no notion of this at all: losing signal showed up only as
 * individual actions failing with "Can't reach the server", which leaves a
 * rider unable to tell a broken app from a rejected delivery from a dead spot —
 * three situations that call for three different responses.
 *
 * `navigator.onLine` is not a guarantee of reachability (a phone can be on a
 * captive wifi that goes nowhere), so this is used to *explain* failures and
 * warn, never to block an action. If the rider wants to try, let them try.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
