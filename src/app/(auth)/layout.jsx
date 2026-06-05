"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import TruckLoader from "@/components/TruckLoader";

export default function AuthLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Never redirect away from password-reset pages or admin/mt-office login — user may be logged in or switching
  const isPasswordPage = pathname?.startsWith("/reset-password") || pathname?.startsWith("/forgot-password");
  
  const [isSigningUp, setIsSigningUp] = useState(() => {
    if (typeof window !== "undefined") {
      return !!sessionStorage.getItem('signup-in-progress');
    }
    return false;
  });
  
  const [isLoggingIn, setIsLoggingIn] = useState(() => {
    if (typeof window !== "undefined") {
      return !!sessionStorage.getItem('login-in-progress');
    }
    return false;
  });

  useEffect(() => {
    const checkAuthStatus = () => {
      if (typeof window !== "undefined") {
        const signupFlag = sessionStorage.getItem('signup-in-progress');
        const loginFlag = sessionStorage.getItem('login-in-progress');
        setIsSigningUp(!!signupFlag);
        setIsLoggingIn(!!loginFlag);
      }
    };

    const interval = setInterval(checkAuthStatus, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading && user && !isSigningUp && !isLoggingIn && !isPasswordPage) {
      router.replace("/");
    }
  }, [loading, user, isSigningUp, isLoggingIn, isPasswordPage, router]);

  if (loading) {
    return (
      <div className="auth-layout min-h-screen flex items-center justify-center relative overflow-hidden">
        <TruckLoader text="Checking session..." />
      </div>
    );
  }

  if (user && !isSigningUp && !isLoggingIn && !isPasswordPage) {
    return null;
  }

  return (
    <div className="auth-layout min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 auth-bg" />

      <div className="absolute top-[8%] left-[12%] w-80 h-80 rounded-full blur-[110px] animate-float-slow"
           style={{ background: "rgba(43, 57, 144, 0.12)" }} />
      <div className="absolute bottom-[10%] right-[8%] w-96 h-96 rounded-full blur-[130px] animate-float-medium"
           style={{ background: "rgba(255, 199, 44, 0.10)" }} />
      <div className="absolute top-[55%] left-[55%] w-72 h-72 rounded-full blur-[90px] animate-float-fast"
           style={{ background: "rgba(212, 32, 39, 0.07)" }} />
      <div className="absolute top-[25%] right-[20%] w-48 h-48 rounded-full blur-[80px] animate-float-slow"
           style={{ background: "rgba(109, 200, 224, 0.08)", animationDelay: "-3s" }} />

      <div className="absolute inset-0 opacity-[0.03]"
           style={{ backgroundImage: "radial-gradient(circle, #2B3990 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}
