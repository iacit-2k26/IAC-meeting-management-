"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Eye, EyeOff, UserPlus, Shield, Building2,
  User, Mail, Lock, Check, Hash
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const BRAND = {
  blue: "#2B3990",
  red: "#D42027",
  gold: "#FFC72C",
  sky: "#6DC8E0",
};

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    employeeId: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const update = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const canSubmit = () => {
    return (
      formData.fullName && 
      formData.email && 
      formData.employeeId && 
      formData.password && 
      formData.password === formData.confirmPassword && 
      formData.agreeTerms
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signUp({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        role: "user",
        employeeId: formData.employeeId,
      });
      
      toast.success("Account created successfully!", {
        description: "You can now sign in to your account.",
        duration: 4000,
      });
      router.replace("/login");
    } catch (err) {
      const errorMessages = {
        "auth/email-already-in-use": "An account with this email already exists. Please sign in.",
        "auth/employee-id-already-in-use": "This Employee ID is already registered. Please use a unique Employee ID.",
        "auth/invalid-employee-id": "Employee ID is required.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Password is too weak. Use at least 8 characters.",
        "auth/operation-not-allowed": "Email/password sign-up is disabled. Contact your admin.",
        "auth/too-many-requests": "Too many sign-up attempts. Please wait a few minutes and try again.",
      };
      const message = errorMessages[err.code] || err.message || "Sign up failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex items-center justify-center w-32 h-10">
            <Image src="/iac-logo.png" alt="IAC Logo" width={120} height={120} priority className="w-30 h-30 object-contain" />
          </div>
          <h1 className="text-2xl font-bold -mt-8 mb-1 tracking-tight" style={{ color: BRAND.blue }}>Create Account</h1>
          <p className="text-slate-500 text-xs">Register for IAC Meeting Central</p>
        </div>

        <div className="auth-card rounded-2xl p-6 sm:p-7 relative z-10 animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  <User size={10} className="inline mr-1.5 -mt-0.5" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={e => update("fullName", e.target.value)}
                  placeholder="your full name"
                  required
                  maxLength={100}
                  className="auth-input w-full !py-2.5"
                  id="signup-name"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  <Mail size={10} className="inline mr-1.5 -mt-0.5" />
                  Work Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => update("email", e.target.value)}
                  placeholder="your work email"
                  required
                  className="auth-input w-full !py-2.5"
                  id="signup-email"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  <Hash size={10} className="inline mr-1.5 -mt-0.5" />
                  Employee ID
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={e => update("employeeId", e.target.value)}
                  placeholder="EMP-001"
                  required
                  className="auth-input w-full !py-2.5"
                  id="signup-emp-id"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  <Lock size={10} className="inline mr-1.5 -mt-0.5" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={e => update("password", e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    className="auth-input w-full pr-11 !py-2.5"
                    id="signup-password"
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

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  <Lock size={10} className="inline mr-1.5 -mt-0.5" />
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={e => update("confirmPassword", e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className={`auth-input w-full pr-11 !py-2.5 ${formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? "!border-red-400 !ring-1 !ring-red-200"
                        : ""
                      }`}
                    id="signup-confirm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-[10px] mt-1" style={{ color: BRAND.red }}>Passwords don&apos;t match</p>
                )}
              </div>

              <label className="flex items-start gap-2 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={formData.agreeTerms}
                    onChange={e => update("agreeTerms", e.target.checked)}
                    className="sr-only"
                  />
                  <div className="w-3.5 h-3.5 rounded-md border-2 shrink-0"
                    style={formData.agreeTerms ? { background: BRAND.blue, borderColor: BRAND.blue } : { borderColor: "#cbd5e1" }}
                  >
                    {formData.agreeTerms && (
                      <svg className="w-2.5 h-2.5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 group-hover:text-slate-700 transition-colors leading-tight">
                  I agree to the <Link href="/terms-of-service" style={{ color: BRAND.blue }} className="hover:underline">Terms</Link> and <Link href="/privacy-policy" style={{ color: BRAND.blue }} className="hover:underline">Privacy</Link>
                </span>
              </label>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={!canSubmit() || loading}
                className="auth-btn w-full !py-2.5"
                id="signup-submit"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-white rounded-full animate-spin" />
                    Creating...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <UserPlus size={14} />
                    Create Account
                  </div>
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold transition-colors hover:opacity-80" style={{ color: BRAND.blue }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center mt-6 mb-3">
          <div className="w-6 h-1 rounded-l" style={{ background: BRAND.blue }} />
          <div className="w-6 h-1 " style={{ background: BRAND.red }} />
          <div className="w-6 h-1 rounded-r" style={{ background: BRAND.gold }} />
        </div>
        <p className="text-center text-xs text-slate-400">
          <Building2 size={12} className="inline mr-1 -mt-0.5" />
          IAC Reports Dashboard &middot; Enterprise Registration
        </p>
      </div>
    </div>
  );
}
