/**
 * React hook that owns the delivery driver WebSocket lifecycle.
 *
 * - Connects on mount (when `token` is provided), disconnects on unmount.
 * - Keeps `wsOnline` (connection state) in sync with socket events.
 * - Surfaces `offeredTrip` when the backend broadcasts a trip_available event
 *   and clears it on trip_claimed (someone else) or trip_released reassignment.
 * - Exposes `claimTrip` and `dismissOffer` for the TripOffer component.
 * - Alerts the rider to a new offer three ways: repeating chime + haptics (they
 *   may be riding), an OS notification (the phone may be pocketed), and the
 *   existing on-screen sheet. The alert stops the moment the offer resolves.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DeliveryTrip } from "@/lib/deliveryTripService";
import { ClaimResult, TripAvailableEvent, deliverySocket } from "@/lib/deliverySocket";
import { play, startOfferAlert } from "@/lib/sound";
import { NOTIFY_ID, isBackgrounded, notify } from "@/lib/notify";

export interface OfferedTrip {
  trip: DeliveryTrip;
  in_range: boolean;
}

/**
 * Stop nagging after this long even if the offer is still on screen. An offer
 * the rider is deliberately ignoring shouldn't turn into an endless alarm; the
 * sheet stays up, only the sound stops.
 */
const OFFER_ALERT_MAX_MS = 30_000;

/** Short, human summary of an offer for the notification body. */
function offerSummary(trip: DeliveryTrip): string {
  const stops = trip.stop_count || trip.stops?.length || 0;
  const parts = [
    stops ? `${stops} stop${stops === 1 ? "" : "s"}` : null,
    trip.earnings != null ? `₹${trip.earnings}` : null,
    trip.total_distance_km ? `${trip.total_distance_km.toFixed(1)} km` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Tap to view the offer.";
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

    // trip_available and trip_released both put an offer on screen, so they get
    // identical treatment.
    const announceOffer = (e: TripAvailableEvent) => {
      setOfferedTrip({ trip: e.trip, in_range: e.in_range });
      // Only bother the notification shade when the rider isn't already looking
      // at the app — otherwise the sheet and the chime have it covered.
      if (isBackgrounded()) {
        void notify({
          title: "New trip available",
          body: offerSummary(e.trip),
          id: NOTIFY_ID.offer,
        });
      }
    };

    const offAvailable = deliverySocket.on("trip_available", announceOffer);
    const offReleased = deliverySocket.on("trip_released", announceOffer);

    const offClaimed = deliverySocket.on("trip_claimed", ({ trip_id }) => {
      setOfferedTrip((current) => {
        if (current?.trip.id === trip_id) {
          if (!claimingRef.current) {
            toast("Trip was just claimed by another driver.");
            play("error");
          }
          return null;
        }
        return current;
      });
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

  // Repeating alert, tied to the presence of an offer. Keyed on the trip id so a
  // replacement offer restarts the alert rather than inheriting the old timer.
  const offeredTripId = offeredTrip?.trip.id ?? null;
  useEffect(() => {
    if (!offeredTripId) return;
    const stop = startOfferAlert();
    const cap = setTimeout(stop, OFFER_ALERT_MAX_MS);
    return () => {
      stop();
      clearTimeout(cap);
    };
  }, [offeredTripId]);

  const claimTrip = useCallback(async (tripId: string): Promise<ClaimResult> => {
    claimingRef.current = true;
    const result = await deliverySocket.claimTrip(tripId);
    claimingRef.current = false;
    if (result.success) {
      setOfferedTrip(null);
      play("success");
    } else {
      toast.error(result.error || "Could not claim trip.");
      play("error");
    }
    return result;
  }, []);

  const dismissOffer = useCallback(() => {
    setOfferedTrip(null);
    play("tick");
  }, []);

  return { wsOnline, offeredTrip, claimTrip, dismissOffer };
}
