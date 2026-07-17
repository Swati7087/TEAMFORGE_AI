import { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as authApi from "../api/auth.api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // On mount: if there's a stored token, validate it with /me.
  // If it's expired/invalid, clear it and stay logged out.
  // loading stays true until this resolves so ProtectedRoute doesn't
  // flash-redirect on refresh.
  useEffect(() => {
    async function bootstrap() {
      const stored = localStorage.getItem("token");
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await authApi.getMe();
        setUser(me);
        setToken(stored);
      } catch {
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function loginUser(email, password) {
    const { token: newToken, user: newUser } = await authApi.login({ email, password });
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }

  async function signupUser(name, email, password) {
    const { token: newToken, user: newUser } = await authApi.signup({ name, email, password });
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }

  // Used by OAuthSuccess: token comes back from Google via URL param,
  // we store it and pull the full user via /me.
  async function setSession(newToken) {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    const { user: me } = await authApi.getMe();
    setUser(me);
    return me;
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    navigate("/login");
  }

  async function refreshUser() {
    const { user: me } = await authApi.getMe();
    setUser(me);
    return me;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginUser,
        signupUser,
        setSession,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
