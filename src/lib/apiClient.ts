export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = this.read("freshon_delivery_access");
    this.refreshToken = this.read("freshon_delivery_refresh");
  }

  setTokens(access: string, refresh?: string) {
    this.token = access;
    localStorage.setItem("freshon_delivery_access", access);
    if (refresh) {
      this.refreshToken = refresh;
      localStorage.setItem("freshon_delivery_refresh", refresh);
    }
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem("freshon_delivery_access");
    localStorage.removeItem("freshon_delivery_refresh");
  }

  async get<T>(endpoint: string, options?: RequestInit) {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit) {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private async request<T>(endpoint: string, options: RequestInit, retry = true): Promise<ApiResponse<T>> {
    const response = await this.fetchRaw<T>(endpoint, options);
    if (response.status === 401 && retry) {
      const nextToken = await this.refreshAccessToken();
      if (nextToken) return this.request<T>(endpoint, options, false);
      // A real 401 we can't recover from → the session is dead. Clear creds and
      // notify the app so it can route the rider back to login. (status 0 =
      // network/offline is intentionally NOT treated as expiry.)
      this.handleAuthExpired();
    }
    return response;
  }

  private handleAuthExpired() {
    this.clearTokens();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("freshon:auth-expired"));
    }
  }

  private async fetchRaw<T>(endpoint: string, options: RequestInit): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "X-App-Platform": "DeliveryApp",
      ...(options.headers as Record<string, string> | undefined),
    };

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        credentials: "include",
        headers,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : await response.text();

      if (!response.ok) {
        return { status: response.status, error: data?.error || data?.detail || data?.message || "Request failed" };
      }

      return { status: response.status, data };
    } catch (error) {
      return { status: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  private async refreshAccessToken() {
    if (!this.refreshToken) return null;
    if (!this.refreshPromise) {
      this.refreshPromise = this.fetchRaw<{ access: string; refresh?: string }>("/api/auth/token/refresh/", {
        method: "POST",
        body: JSON.stringify({ refresh: this.refreshToken }),
      }).then((response) => {
        if (response.data?.access) {
          this.setTokens(response.data.access, response.data.refresh);
          return response.data.access;
        }
        this.clearTokens();
        return null;
      }).finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private read(key: string) {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  }
}

export const apiClient = new ApiClient();
