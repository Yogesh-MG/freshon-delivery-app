import { PackageOpen, PowerOff } from "lucide-react";

/**
 * What the dashboard shows when there is no work on screen.
 *
 * This replaced a radar sweep. The radar looked like the app was actively
 * searching, which is not what is happening — the pool is polled on refresh and
 * pushed over the socket, and an empty pool simply means there are no orders.
 * A rider watching an animation that implies a search in progress waits instead
 * of pulling to refresh or checking whether they are online at all.
 *
 * The two states are kept distinct because they need different actions: being
 * offline is something the rider fixes, an empty pool is something they wait
 * out.
 */
export const PoolEmpty = ({ online }: { online: boolean }) => {
  const Icon = online ? PackageOpen : PowerOff;

  return (
    <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-10 text-center shadow-card-soft ring-1 ring-border">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="mt-4 text-base font-extrabold text-foreground">
        {online ? "No orders available at the moment" : "You're offline"}
      </div>
      <p className="mt-1 max-w-[38ch] text-sm text-muted-foreground">
        {online
          ? "New orders appear here as soon as they're dispatched. Pull down to refresh."
          : "Go online to start receiving orders."}
      </p>
    </div>
  );
};
