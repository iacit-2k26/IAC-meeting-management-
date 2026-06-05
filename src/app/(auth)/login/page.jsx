"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, LogIn, ChevronDown, Shield, Building2 } from "lucide-react";
import { ROLES } from "@/lib/roles";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const BRAND = {
  blue: "#2B3990",
  red: "#D42027",
  gold: "#FFC72C",
  sky: "#6DC8E0",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password, false, null);
      toast.success("Signed in successfully!");
      router.replace("/");
    } catch (err) {
      const errorMessages = {
        "auth/user-not-found": "No account found with this email. Please sign up first.",
        "auth/wrong-password": "Incorrect password. Please try again.",
        "auth/invalid-credential": "Invalid email or password. Please check and try again.",
        "auth/unauthorized-role": "Role mismatch. Please select the correct role for your account.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/too-many-requests": "Too many failed attempts. Please try again later.",
        "auth/user-disabled": "This account has been disabled.",
      };
      const message = errorMessages[err.code] || err.message || "Sign in failed. Please try again.";
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex items-center justify-center w-32 h-10">
            <Image src="/iac-logo.png" alt="IAC Logo" width={120} height={120} className="w-30 h-30 object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold -mt-8 mb-1 tracking-tight" style={{ color: BRAND.blue }}>Welcome Back</h1>
          <p className="text-slate-500 text-xs">Sign in to IAC Reports Dashboard</p>
        </div>

        <div className="auth-card rounded-2xl p-6 sm:p-7 animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@indiaautismcenter.org"
                required
                className="auth-input w-full !py-2.5"
                id="login-email"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="auth-input w-full pr-11 !py-2.5"
                  id="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-3.5 h-3.5 rounded-md border-2 transition-all duration-200`}
                       style={remember ? { background: BRAND.blue, borderColor: BRAND.blue } : { borderColor: "#cbd5e1" }}
                  >
                    {remember && (
                      <svg className="w-2.5 h-2.5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: BRAND.red }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-btn w-full !py-2.5"
              id="login-submit"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <LogIn size={14} />
                  Sign In
                </div>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold transition-colors hover:opacity-80" style={{ color: BRAND.blue }}>
                Create Account
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center mt-6 mb-3 animate-fade-in-delayed">
          <div className="w-6 h-1 rounded-l" style={{ background: BRAND.blue }} />
          <div className="w-6 h-1 " style={{ background: BRAND.red }} />
          <div className="w-6 h-1 rounded-r" style={{ background: BRAND.gold }} />
        </div>
        <div className="text-center text-xs text-slate-400 animate-fade-in-delayed space-y-2">
          <p>
            <Building2 size={12} className="inline mr-1 -mt-0.5" />
            IAC Reports Dashboard &middot; Secure Enterprise Login
          </p>
          {/* <p>
            <Link href="/admin-login" className="text-slate-500 hover:text-[#2B3990] transition-colors font-medium">
              Admin Login
            </Link>
            {" · "}
            <Link href="/mt-office-login" className="text-slate-500 hover:text-[#2B3990] transition-colors font-medium">
              MT&apos;s Office Login
            </Link>
          </p> */}
        </div>
      </div>
    </div>
  );
}
