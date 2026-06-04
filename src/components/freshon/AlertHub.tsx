import { Bell, TrendingUp } from "lucide-react";

export const AlertHub = ({ assignmentCount }: { assignmentCount: number }) => {
  const alerts = [
    { id: "a1", type: "surge", title: "Delivery status synced", body: "Online status and GPS updates are sent to FreshOn." },
    {
      id: "a2",
      type: "order",
      title: assignmentCount > 0 ? `${assignmentCount} active assignment${assignmentCount === 1 ? "" : "s"}` : "No assignments yet",
      body: assignmentCount > 0 ? "Open your mission queue to continue delivery." : "Go online and refresh when dispatch assigns an order.",
    },
  ];

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const isSurge = a.type === "surge";
        const Icon = isSurge ? TrendingUp : Bell;
        return (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-2xl glass p-3 shadow-card-soft animate-fade-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isSurge ? "bg-gradient-amber text-accent-foreground" : "bg-primary-soft text-primary"}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
