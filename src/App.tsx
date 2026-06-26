import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Earnings from "./pages/Earnings.tsx";
import Profile from "./pages/Profile.tsx";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createOtaUpdater } from "@freshon/api/ota";

const queryClient = new QueryClient();

// OTA self-updater — checks the cloud for a newer web bundle in the background
// and stages it for the NEXT launch. No-op off-Tauri, so it's safe everywhere.
const ota = createOtaUpdater({
  app: "del",
  baseUrl: "https://api.freshon.in/ota",
  currentVersion: (import.meta.env.VITE_BUNDLE_VERSION as string) ?? "0",
  nativeVersion: "1.0.0",
  invoke,
});

const Protected = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App = () => {
  // OTA: confirm THIS bundle booted (promotes a trial bundle to active and
  // disarms native rollback), then check the cloud for a newer bundle in the
  // background. Runs once; never blocks paint.
  useEffect(() => {
    ota.confirmBoot();
    ota.checkInBackground();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
            <Route path="/" element={<Protected><Index /></Protected>} />
            <Route path="/earnings" element={<Protected><Earnings /></Protected>} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
