"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  brandId?: string | null;
  factoryId?: string | null;
  distributorId?: string | null;
  labId?: string | null;
  mustChangePassword?: boolean;
  emailVerified?: boolean;
  canClaim?: boolean;
}

interface ImpersonationInfo {
  active: boolean;
  targetName: string;
  targetRole: string;
  targetEmail: string;
  entityName: string | null;
  realAdmin: {
    id: string;
    name: string;
    email: string;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  impersonation: ImpersonationInfo | null;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; user?: AuthUser; mustChangePassword?: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  startImpersonating: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  impersonation: null,
  login: async () => ({ ok: false }),
  logout: async () => {},
  refresh: async () => {},
  startImpersonating: async () => ({ ok: false }),
  stopImpersonating: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonation, setImpersonation] = useState<ImpersonationInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.user) {
          setUser(data.user);
          setImpersonation(data.impersonating || null);
          return;
        }
      }
      setUser(null);
      setImpersonation(null);
    } catch {
      setUser(null);
      setImpersonation(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.ok && data.user) {
        const enrichedUser = { ...data.user, mustChangePassword: data.mustChangePassword || false };
        setUser(enrichedUser);
        setImpersonation(null);
        return { ok: true, user: enrichedUser, mustChangePassword: data.mustChangePassword };
      }
      return { ok: false, error: data.error || "Login failed" };
    } catch {
      return { ok: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      // Stop impersonation first if active
      if (impersonation) {
        await fetch("/api/admin/impersonate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop" }),
        });
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    setImpersonation(null);
    window.location.href = "/login";
  };

  const startImpersonating = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", userId }),
      });
      const data = await res.json();
      if (data.ok) {
        // Refresh to pick up the impersonated user
        await refresh();
        return { ok: true };
      }
      return { ok: false, error: data.error || "Failed to impersonate" };
    } catch {
      return { ok: false, error: "Network error" };
    }
  };

  const stopImpersonating = async () => {
    try {
      await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      await refresh();
    } catch {
      // Force reload on error
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        impersonation,
        login,
        logout,
        refresh,
        startImpersonating,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
