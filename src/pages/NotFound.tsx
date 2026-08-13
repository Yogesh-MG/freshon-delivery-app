import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass } from "lucide-react";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { Wordmark } from "@/components/freshon/Wordmark";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    // Same shell as every other screen — a bare full-bleed page read as a crash
    // rather than a wrong turn inside the app.
    <main className="h-dvh overflow-hidden">
      <PhoneFrame>
        <div className="flex h-full flex-col">
          <header className="px-5 pt-7">
            <Wordmark />
          </header>

          <div className="flex flex-1 flex-col items-center justify-center px-5 pb-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-soft text-primary">
              <Compass className="h-8 w-8" />
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-foreground">404</h1>
            <p className="mt-1 text-sm text-muted-foreground">Oops! Page not found</p>
            <a
              href="/"
              className="mt-6 flex items-center justify-center rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition active:scale-[0.98]"
            >
              Return to Home
            </a>
          </div>
        </div>
      </PhoneFrame>
    </main>
  );
};

export default NotFound;
