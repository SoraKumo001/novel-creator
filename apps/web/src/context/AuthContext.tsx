import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchAuthSession,
  fetchAuthStatus,
  setupInitialAdmin,
  signInWithEmail,
  signInWithGoogle as signInWithGoogleRequest,
  signOut as signOutRequest,
  signUpWithEmail,
  updateUserProfile,
} from "@/lib/services/auth.js";
import type { AuthUser } from "@/lib/types.js";

export interface AuthContextValue {
  authLoading: boolean;
  googleAuthEnabled: boolean;
  initialized: boolean | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  setupAdmin: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (callbackURL?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  user: AuthUser | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const fallbackValue: AuthContextValue = {
  authLoading: false,
  googleAuthEnabled: false,
  initialized: null,
  isAdmin: false,
  isAuthenticated: false,
  refresh: () => Promise.resolve(),
  setupAdmin: () => Promise.resolve(),
  signIn: () => Promise.resolve(),
  signInWithGoogle: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  signUp: () => Promise.resolve(),
  updateProfile: () => Promise.resolve(),
  user: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const refresh = useCallback(async () => {
    setAuthLoading(true);
    try {
      const status = await fetchAuthStatus();
      setInitialized(status.initialized);
      setGoogleAuthEnabled(status.googleAuthEnabled === true);
      if (!status.initialized) {
        setUser(null);
        return;
      }
      const session = await fetchAuthSession();
      setUser(session.user);
    } catch {
      // バックエンド未起動・未実装時はブロックせず unknown のまま通す
      setInitialized((prev) => prev);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await signInWithEmail(email, password);
    setUser(session.user);
    setInitialized(true);
  }, []);

  const signInWithGoogle = useCallback(async (callbackURL?: string) => {
    await signInWithGoogleRequest(callbackURL);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const session = await signUpWithEmail(email, password, name);
      setUser(session.user);
      setInitialized(true);
    },
    []
  );

  const signOut = useCallback(async () => {
    await signOutRequest();
    setUser(null);
  }, []);

  const setupAdmin = useCallback(
    async (email: string, password: string, name: string) => {
      const session = await setupInitialAdmin(email, password, name);
      setUser(session.user);
      setInitialized(true);
    },
    []
  );

  const updateProfile = useCallback(async (name: string) => {
    const updated = await updateUserProfile(name);
    setUser(updated);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initialized,
      googleAuthEnabled,
      authLoading,
      isAuthenticated: user !== null,
      isAdmin: user?.role === "admin",
      refresh,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      setupAdmin,
      updateProfile,
    }),
    [
      user,
      initialized,
      googleAuthEnabled,
      authLoading,
      refresh,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      setupAdmin,
      updateProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return fallbackValue;
  }
  return context;
}
