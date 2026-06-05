"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/AuthContext";
import TruckLoader from "@/components/TruckLoader";

function subscribeToSidebarPreference(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("sidebar-collapsed-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("sidebar-collapsed-change", callback);
  };
}

function getSidebarPreferenceSnapshot() {
  return window.localStorage.getItem("sidebar-collapsed") === "true";
}

export default function ClientLayout({ children }) {
  const [navigating, setNavigating] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthRoute = pathname === "/login" || 
                     pathname === "/signup" || 
                     pathname === "/forgot-password" || 
                     pathname === "/reset-password";

  const collapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreferenceSnapshot,
    () => false
  );

  const handleToggleCollapse = (value) => {
    window.localStorage.setItem("sidebar-collapsed", String(value));
    window.dispatchEvent(new Event("sidebar-collapsed-change"));
  };

  useEffect(() => {
    if (!navigating) return;
    const timer = setTimeout(() => setNavigating(false), 450);
    return () => clearTimeout(timer);
  }, [navigating]);

  useEffect(() => {
    if (!loading && !user && !isAuthRoute) {
      router.replace("/login");
    }
  }, [user, loading, isAuthRoute, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <TruckLoader text="Checking session..." />
      </div>
    );
  }

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {navigating && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gradient-to-r from-[#2B3990] via-[#6DC8E0] to-[#FFC72C] animate-pulse" />
      )}
      <Sidebar
        onNavigate={() => setNavigating(true)}
        collapsed={collapsed}
        setCollapsed={handleToggleCollapse}
      />
      <main className="flex-1 overflow-y-auto w-full lg:pl-[58px]">
        <div
          className={`w-full mx-auto px-4 pb-4 pt-16 sm:px-6 sm:py-6 lg:px-6 lg:py-5 transition-all duration-300 ${
            collapsed ? "max-w-none" : "max-w-[1600px]"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}