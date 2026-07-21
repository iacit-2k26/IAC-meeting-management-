"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Video,
  Menu,
  X,
  LogOut,
  Settings,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const W_COLLAPSED = 58;
const W_EXPANDED = 252;
const BRAND_BLUE = "#2B3990";

export default function Sidebar({ onNavigate, collapsed, setCollapsed }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const sidebarRef = useRef(null);
  const leaveTimer = useRef(null);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const userInitials = useMemo(() => {
    if (!user?.fullName) return "??";
    return user.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [user?.fullName]);

  const showLabels = mobileOpen || isExpanded || !collapsed;

  const navItems = useMemo(
    () => {
      const items = [
        { label: "Dashboard",   icon: LayoutDashboard, href: "/dashboard"   },
        { label: "Employees",   icon: Users,           href: "/employees"   },
        { label: "Departments", icon: Building2,        href: "/departments" },
        { label: "Meetings",    icon: Video,            href: "/meetings"    },
        { label: "App Users",   icon: UserCog,          href: "/users", adminOnly: true },
        { label: "Settings",    icon: Settings,         href: "/settings"    },
      ];

      if (user?.role !== "admin") {
        return items.filter((item) => !item.adminOnly);
      }
      return items;
    },
    [user?.role]
  );

  useEffect(() => {
    const fn = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const handleMouseEnter = () => {
    clearTimeout(leaveTimer.current);
    if (collapsed) setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      if (collapsed) setIsExpanded(false);
    }, 90);
  };

  // Reset expanded state on every navigation so it never gets stuck
  useEffect(() => {
    if (collapsed) setIsExpanded(false);
  }, [pathname, collapsed]);

  useEffect(() => {
    return () => clearTimeout(leaveTimer.current);
  }, []);

  const NavItem = ({ label, icon: Icon, href }) => {
    const active = pathname === href || pathname?.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        onClick={() => {
          setMobileOpen(false);
          if (pathname !== href && onNavigate) onNavigate();
        }}
        title={label}
        className={[
          "group relative flex items-center rounded-[10px] overflow-hidden select-none",
          showLabels ? "justify-start" : "justify-center",
        ].join(" ")}
        style={{
          height: 38,
          margin: "2px 6px",
          paddingLeft: showLabels ? 12 : 0,
          paddingRight: showLabels ? 10 : 0,
          background: active ? "rgba(43,57,144,0.08)" : "transparent",
          border: `1px solid ${active ? "rgba(43,57,144,0.26)" : "transparent"}`,
          boxShadow: active ? "0 4px 12px rgba(43,57,144,0.14)" : "none",
          transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
          style={{
            width: 3,
            height: active ? "52%" : 0,
            background: BRAND_BLUE,
            transition: "height 0.2s ease",
          }}
        />

        <span className="shrink-0 flex items-center justify-center" style={{ width: 20, height: 20 }}>
          <Icon
            size={16}
            style={{ color: active ? BRAND_BLUE : "#92a0b8", transition: "color 0.2s ease" }}
          />
        </span>

        <span
          className="text-[13px] font-medium leading-[1.2] pointer-events-none"
          style={{
            marginLeft: showLabels ? 10 : 0,
            color: active ? BRAND_BLUE : "#4f5f7d",
            whiteSpace: "nowrap",
            maxWidth: showLabels ? 170 : 0,
            overflow: "hidden",
            transition: "max-width 0.2s ease, margin-left 0.2s ease",
          }}
        >
          {label}
        </span>

        {!active && (
          <span
            className="absolute inset-0 rounded-[10px] opacity-0 group-hover:opacity-100 pointer-events-none"
            style={{
              background: "rgba(43,57,144,0.06)",
              transition: "opacity 0.2s ease",
            }}
          />
        )}
      </Link>
    );
  };

  return (
    <>
      {!mobileOpen && (
        <button
          className="lg:hidden fixed top-3 left-4 z-50 p-2 rounded-xl bg-white shadow border border-slate-200"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={18} className="text-slate-600" />
        </button>
      )}

      <div
        className={[
          "lg:hidden fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-sm",
          "transition-opacity duration-300",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={[
          "fixed inset-y-0 left-0 z-40 h-full flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0",
        ].join(" ")}
        style={{
          width: showLabels ? W_EXPANDED : W_COLLAPSED,
          minWidth: W_COLLAPSED,
          overflow: "hidden",
          background: "linear-gradient(180deg,#ffffff 0%,#fbfcff 100%)",
          borderRight: "1px solid #e7ecf6",
          boxShadow: showLabels ? "10px 0 26px rgba(15,23,42,0.10)" : "3px 0 10px rgba(15,23,42,0.06)",
          transition: mobileOpen
            ? "transform 0.3s cubic-bezier(0.22,1,0.36,1), width 0.2s ease-out, box-shadow 0.2s ease-out"
            : "width 0.2s ease-out, box-shadow 0.2s ease-out",
        }}
      >
        <div
          className={["flex items-center shrink-0", showLabels ? "" : "justify-center"].join(" ")}
          style={{
            height: 56,
            borderBottom: "1px solid #edf1f8",
            padding: "0 10px",
            gap: showLabels ? 10 : 0,
          }}
        >
     <div
            className="shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
            style={{
              width: 32, height: 32,
              background: "#f8faff",
              border: "1px solid #e6ebf5",
              boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
            }}
          >
            <Image src="/iac-logo.png" alt="IAC" width={22} height={22} priority className="object-contain" />
          </div>

          <div
            className="flex flex-col overflow-hidden"
            style={{
              whiteSpace: "nowrap",
              maxWidth: showLabels ? 140 : 0,
              transition: "max-width 0.2s ease",
            }}
          >
            <span className="text-[13px] font-black tracking-[0.05em] leading-tight" style={{ color: BRAND_BLUE }}>
              IAC Meeting Central
            </span>
            <span className="text-[9px] tracking-wide leading-tight mt-0.5" style={{ color: "#97a5bd" }}>
              Management System
            </span>
          </div>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden ml-auto p-1.5 rounded-lg hover:bg-slate-100 shrink-0"
            style={{ color: "#8ea0bb" }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-1.5 pt-3 pb-2">
          <div
            className={["flex items-center rounded-xl overflow-hidden", showLabels ? "" : "justify-center"].join(" ")}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f3",
              boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
              padding: showLabels ? "7px 10px" : "8px 6px",
            }}
          >
            <div
              className="relative shrink-0 flex items-center justify-center rounded-lg text-[10px] font-bold text-white"
              style={{
                width: 28,
                height: 28,
                background: `linear-gradient(135deg,${BRAND_BLUE},#4f60c2)`,
                boxShadow: "0 4px 12px rgba(43,57,144,0.28)",
              }}
            >
              {userInitials}
            </div>
            {showLabels && (
              <div className="ml-2 leading-tight overflow-hidden">
                <div className="text-[12px] font-semibold text-slate-700 truncate">
                  {user?.fullName || "Loading..."}
                </div>
                <div className="text-[9px] text-slate-400 truncate lowercase">
                  {user?.email || "Account Active"}
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto hide-scrollbar pt-2">
          {navItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-100 flex flex-col gap-1">
          <button
            onClick={logout}
            className={[
              "flex items-center rounded-lg transition-colors hover:bg-red-50 text-slate-500 hover:text-red-600",
              showLabels ? "px-3 py-2" : "justify-center p-2",
            ].join(" ")}
          >
            <LogOut size={16} />
            {showLabels && <span className="ml-3 text-[11px] font-semibold">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
