import { ReactNode } from "react";

export const PhoneFrame = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-transparent md:my-6 md:h-[calc(100dvh-3rem)] md:rounded-[36px] md:bg-card md:shadow-elevated md:ring-1 md:ring-border">
    <div className="flex flex-col h-full min-h-0 flex-1 overflow-hidden md:rounded-[36px]">{children}</div>
  </div>
);
