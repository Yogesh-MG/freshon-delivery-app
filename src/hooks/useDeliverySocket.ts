/**
 * React hook that owns the delivery driver WebSocket lifecycle.
 *
 * - Connects on mount (when `token` is provided), disconnects on unmount.
 * - Keeps `wsOnline` (connection state) in sync with socket events.
 * - Surfaces `offeredTrip` when the backend broadcasts a trip_available event
 *   and clears it on trip_claimed (someone else) or trip_released reassignment.
 * - Exposes `claimTrip` and `dismissOffer` for the TripOffer component.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeliveryTrip } from "@/lib/deliveryTripService";
import { ClaimResult, TripAvailableEvent, deliverySocket } from "@/lib/deliverySocket";

export interface OfferedTrip {
  trip: DeliveryTrip;
  in_range: boolean;
}

export function useDeliverySocket(token: string | null) {
  const [wsOnline, setWsOnline] = useState(false);
  const [offeredTrip, setOfferedTrip] = useState<OfferedTrip | null>(null);
  const claimingRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    deliverySocket.connect(token);

    const offConnected = deliverySocket.on("connected", () => setWsOnline(true));
    const offDisconnected = deliverySocket.on("disconnected", () => setWsOnline(false));

    const offAvailable = deliverySocket.on("trip_available", (e: TripAvailableEvent) => {
      setOfferedTrip({ trip: e.trip, in_range: e.in_range });
    });

    const offClaimed = deliverySocket.on("trip_claimed", ({ trip_id }) => {
      setOfferedTrip((current) => {
        if (current?.trip.id === trip_id) {
          if (!claimingRef.current) toast("Trip was just claimed by another driver.");
          return null;
        }
        return current;
      });
    });

    const offReleased = deliverySocket.on("trip_released", (e: TripAvailableEvent) => {
      setOfferedTrip({ trip: e.trip, in_range: e.in_range });
    });

    return () => {
      offConnected();
      offDisconnected();
      offAvailable();
      offClaimed();
      offReleased();
      deliverySocket.disconnect();
    };
  }, [token]);

  const claimTrip = useCallback(async (tripId: string): Promise<ClaimResult> => {
    claimingRef.current = true;
    const result = await deliverySocket.claimTrip(tripId);
    claimingRef.current = false;
    if (result.success) {
      setOfferedTrip(null);
    } else {
      toast.error(result.error || "Could not claim trip.");
    }
    return result;
  }, []);

  const dismissOffer = useCallback(() => setOfferedTrip(null), []);

  return { wsOnline, offeredTrip, claimTrip, dismissOffer };
}
