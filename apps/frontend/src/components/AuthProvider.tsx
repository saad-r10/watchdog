import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AuthContext, type AuthUser } from "../hooks/useAuth";
import { api } from "../services/api";
import { tokenStore } from "../lib/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) { setIsLoading(false); return; }
    api.auth.me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login({ email, password });
    if ("requiresMfa" in result) {
      return { requiresMfa: true as const, mfaToken: result.mfaToken };
    }
    tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  const mfaVerify = useCallback(async (mfaToken: string, code: string) => {
    const { token, user } = await api.auth.mfaVerify({ mfaToken, code });
    tokenStore.set(token);
    setUser(user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { token, user } = await api.auth.register({ email, password, name });
    tokenStore.set(token);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, mfaVerify, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
