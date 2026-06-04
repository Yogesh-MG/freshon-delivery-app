import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { backendAuthService } from "@/lib/backendAuthService";
import { ApiResult, DeliveryAuthUser } from "@/lib/types";

interface SendOtpResponse {
  phone: string;
  message: string;
}

interface AuthCtx {
  user: DeliveryAuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  sendOtp: (phone: string) => Promise<ApiResult<SendOtpResponse>>;
  verifyOtp: (phone: string, otp: string) => Promise<ApiResult<DeliveryAuthUser>>;
}

const Ctx = createContext<AuthCtx>({ 
  user: null, 
  loading: true, 
  signOut: async () => {},
  sendOtp: async () => ({ success: false, error: "Auth provider is not ready" }),
  verifyOtp: async () => ({ success: false, error: "Auth provider is not ready" })
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<DeliveryAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = backendAuthService.getStoredUser();
    if (saved) setUser(saved);
    backendAuthService.getCurrentUser().then((result) => {
      if (result.success && result.data) setUser(result.data);
      setLoading(false);
    });
  }, []);

  const sendOtp = async (phone: string) => {
    return await backendAuthService.sendOtp(phone);
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const result = await backendAuthService.verifyOtp(phone, otp);
    if (result.success && result.data) setUser(result.data);
    return result;
  };

  const signOut = async () => {
    await backendAuthService.logout();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, signOut, sendOtp, verifyOtp }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
