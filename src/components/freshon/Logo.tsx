export const FreshOnLogo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="relative h-9 w-9 rounded-2xl bg-gradient-primary shadow-glow-primary grid place-items-center">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c4 3 6 6 6 10a6 6 0 0 1-12 0c0-4 2-7 6-10z" />
        <path d="M12 22V10" />
      </svg>
    </div>
    <div className="leading-tight">
      <div className="font-extrabold tracking-tight text-foreground">FreshOn<span className="text-primary"> Go</span></div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Partner</div>
    </div>
  </div>
);
