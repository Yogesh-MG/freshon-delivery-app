import { ReactNode } from "react";

export const PhoneFrame = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex h-[var(--app-height)] w-full max-w-md flex-col bg-transparent md:my-6 md:h-[calc(100dvh-3rem)] md:rounded-[36px] md:bg-card md:shadow-elevated md:ring-1 md:ring-border">
    {/* Device safe-area insets (status bar / notch top, gesture bar bottom) are
        applied here so every screen's content stays clear of the system bars
        while the shell still fills the viewport. */}
    <div className="flex flex-col h-full min-h-0 flex-1 overflow-hidden pt-safe pb-safe pl-safe pr-safe md:rounded-[36px] md:p-0">
      {children}
    </div>
  </div>
);
