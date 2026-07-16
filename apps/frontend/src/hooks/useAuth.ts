import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  mfaEnabled?: boolean;
  role?: string;
}

export interface MfaChallengeResult {
  requiresMfa: true;
  mfaToken: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<MfaChallengeResult | void>;
  mfaVerify: (mfaToken: string, code: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
