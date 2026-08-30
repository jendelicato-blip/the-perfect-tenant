import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "@/lib/data/api";
import type { AuthUser } from "@/lib/data/api";
import type { Role } from "@/types/domain";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: Role) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    async signIn(email, password) {
      const u = await api.signIn(email, password);
      setUser(u);
    },
    async signUp(email, password, role) {
      const u = await api.signUp(email, password, role);
      setUser(u);
    },
    async signOut() {
      await api.signOut();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
