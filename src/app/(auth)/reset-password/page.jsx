"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import TruckLoader from "@/components/TruckLoader";
import { useAuth } from "@/lib/AuthContext";

const BRAND = {
  blue: "#2B3990",
  red: "#D42027",
  gold: "#FFC72C",
};

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;

  const err = new Error(payload?.error || "Request failed");
  err.code = payload?.code;
  throw err;
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { confirmPasswordReset } = useAuth();

  const token = String(searchParams.get("token") || "").trim();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const validateToken = async () => {
      if (!token) {
        setTokenValid(false);
        setTokenError("This reset link is missing or invalid.");
        setValidating(false);
        return;
      }

      try {
        await parseResponse(
          await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`, {
            method: "GET",
            cache: "no-store",
          })
        );
        if (cancelled) return;
        setTokenValid(true);
        setTokenError("");
      } catch (error) {
        if (cancelled) return;
        setTokenValid(false);
        setTokenError(error.message || "This reset link is invalid or has expired.");
      } finally {
        if (!cancelled) {
          setValidating(false);
        }
      }
    };

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(token, password);
      toast.success("Password updated successfully. Please sign in.");
      router.replace("/login");
    } catch (error) {
      const message =
        error.code === "auth/reset-token-invalid"
          ? "This reset link is invalid or has expired."
          : error.code === "auth/weak-password"
            ? "Password must be at least 8 characters."
            : error.message || "Could not reset password.";
      toast.error(message);
      if (error.code === "auth/reset-token-invalid") {
        setTokenValid(false);
        setTokenError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <TruckLoader text="Validating reset link..." />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-7 animate-fade-in">
          <div className="inline-flex items-center justify-center w-32 h-10">
            <Image src="/iac-logo.png" alt="IAC Logo" width={120} height={120} className="w-30 h-30 object-contain" priority />
          </div>
          <h1 className="text-3xl font-bold -mt-8 mb-2 tracking-tight" style={{ color: BRAND.blue }}>
            Reset Password
          </h1>
          <p className="text-slate-500 text-sm">
            {tokenValid ? "Choose a new password for your account" : "This link cannot be used anymore"}
          </p>
        </div>

        <div className="auth-card rounded-2xl p-7 sm:p-8 animate-slide-up">
          {!tokenValid ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
                  <div>
                    <p className="font-semibold text-red-600">Reset link unavailable</p>
                    <p className="mt-1 text-sm text-red-500">{tokenError || "This reset link is invalid or has expired."}</p>
                  </div>
                </div>
              </div>

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
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-700">Verified reset link</p>
                    <p className="mt-1 text-sm text-emerald-600">Set your new password below. After saving, use it on the login page.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter new password"
                    className="auth-input w-full pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter new password"
                    className="auth-input w-full pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="auth-btn w-full">
                {submitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating password...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <KeyRound size={16} />
                    Save New Password
                  </div>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="flex items-center justify-center mt-6 mb-3 animate-fade-in-delayed">
          <div className="w-6 h-1 rounded-l" style={{ background: BRAND.blue }} />
          <div className="w-6 h-1" style={{ background: BRAND.red }} />
          <div className="w-6 h-1 rounded-r" style={{ background: BRAND.gold }} />
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4 py-8">
          <TruckLoader text="Loading reset page..." />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
