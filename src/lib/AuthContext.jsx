"use client";
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;

  const err = new Error(payload?.error || "Request failed");
  err.code = payload?.code;
  throw err;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  
  const loadSession = async () => {
    try {
      const response = await fetch("/api/auth/me", { method: "GET", cache: "no-store" });
      const payload = await parseResponse(response);
      setUser(payload?.user || null);
      if (!payload?.user) {
        sessionStorage.removeItem("signup-in-progress");
        sessionStorage.removeItem("login-in-progress");
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    let stopped = false;
    let lastPingTime = 0;
    // Minimum gap between pings to prevent burst on rapid tab switching
    const MIN_PING_INTERVAL_MS = 10000;

    const pingPresence = async () => {
      if (stopped) return;
      const now = Date.now();
      if (now - lastPingTime < MIN_PING_INTERVAL_MS) return;
      lastPingTime = now;
      try {
        await fetch("/api/auth/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          keepalive: true,
        });
      } catch {
        // Presence ping is best effort.
      }
    };

    pingPresence();
    const intervalId = setInterval(pingPresence, 45000);

    // Use only visibilitychange — covers both tab switch and window focus,
    // avoiding the double-fire that happens when both "focus" and
    // "visibilitychange" fire together on tab restore.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        pingPresence();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.uid]);

  const refreshUser = async () => {
    await loadSession();
  };

  const signIn = async (email, password, adminOnly = false, selectedRole = "user", mtOfficeOnly = false) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, adminOnly, selectedRole: selectedRole || "user", mtOfficeOnly }),
    });

    const payload = await parseResponse(response);
    setUser(payload?.user || null);
    return payload?.user || null;
  };

  const signUp = async (data) => {
    sessionStorage.setItem("signup-in-progress", "true");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await parseResponse(response);
      setUser(null);
      return payload?.user || null;
    } catch (error) {
      sessionStorage.removeItem("signup-in-progress");
      throw error;
    }
  };

  const resetPassword = async (email) => {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    return parseResponse(response);
  };

  const confirmPasswordReset = async (token, password) => {
    const response = await fetch("/api/auth/reset-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    return parseResponse(response);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      sessionStorage.removeItem("login-in-progress");
      sessionStorage.removeItem("signup-in-progress");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, resetPassword, confirmPasswordReset, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
