export const RadarWaiting = () => (
  <div className="relative overflow-hidden rounded-3xl glass p-6 text-center shadow-card-soft">
    <div className="relative mx-auto h-32 w-32">
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-3 w-3 rounded-full bg-primary shadow-glow-primary" />
      </div>
      {[0, 0.6, 1.2].map((d, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar"
          style={{ animationDelay: `${d}s` }}
        />
      ))}
    </div>
    <div className="mt-3 text-sm font-semibold text-foreground">Scanning the city</div>
    <div className="text-xs text-muted-foreground">Listening for nearby orders…</div>
  </div>
);
