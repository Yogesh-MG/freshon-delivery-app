import { ReactNode } from "react";

export const PhoneFrame = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-transparent md:my-6 md:min-h-0 md:rounded-[36px] md:bg-card md:shadow-elevated md:ring-1 md:ring-border">
    <div className="flex-1 overflow-hidden md:rounded-[36px]">{children}</div>
  </div>
);
