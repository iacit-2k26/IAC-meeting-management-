"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

const BRAND = {
  blue: "#2B3990",
  red: "#D42027",
  gold: "#FFC72C",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const target = email.trim();
    if (!target) {
      toast.error("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(target);
      setSent(true);
    } catch (err) {
      const errorMessages = {
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
      };
      const message = errorMessages[err.code] || err.message || "Could not send reset email. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo + Title */}
        <div className="text-center mb-7 animate-fade-in">
          <div className="inline-flex items-center justify-center w-32 h-10">
            <Image src="/iac-logo.png" alt="IAC Logo" width={120} height={120} className="w-30 h-30 object-contain" priority />
          </div>
          <h1 className="text-3xl font-bold -mt-2 mb-2 tracking-tight" style={{ color: BRAND.blue }}>
            Forgot Password
          </h1>
          <p className="text-slate-500 text-sm">
            {sent ? "Check your inbox for a reset link" : "We&apos;ll send a reset link to your email"}
          </p>
        </div>

        <div className="auth-card rounded-2xl p-7 sm:p-8 animate-slide-up">
          {sent ? (
            /* Success state */
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-500" />
                <p className="font-semibold text-emerald-700">Reset email sent!</p>
                <p className="mt-1 text-sm text-emerald-600">
                  If <span className="font-medium">{email} </span> is registered, you&apos;ll receive a
                  password reset link shortly. Check your spam folder too.
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setSent(false); setEmail(""); }}
                className="w-full text-sm text-center py-2 font-medium transition-colors hover:opacity-80"
                style={{ color: BRAND.blue }}
              >
                Try a different email
              </button>

              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
                style={{ background: BRAND.blue }}
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          ) : (
            /* Form state */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@indiaautismcenter.org"
                    className="auth-input w-full pl-10"
                    required
                    autoFocus
                    id="forgot-email"
                  />
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-btn w-full"
                id="forgot-submit"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending reset link...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Send size={16} />
                    Send Reset Link
                  </div>
                )}
              </button>

              <div className="pt-1 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: BRAND.blue }}
                >
                  <ArrowLeft size={14} />
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Brand bar */}
        <div className="flex items-center justify-center mt-6 mb-3 animate-fade-in-delayed">
          <div className="w-6 h-1 rounded-l" style={{ background: BRAND.blue }} />
          <div className="w-6 h-1" style={{ background: BRAND.red }} />
          <div className="w-6 h-1 rounded-r" style={{ background: BRAND.gold }} />
        </div>
      </div>
    </div>
  );
}
