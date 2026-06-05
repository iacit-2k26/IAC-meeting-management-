"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Key, Eye, EyeOff, Save, User, Mail, Shield, Settings as SettingsIcon, Edit2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { getRoleLabel } from "@/lib/roles";

const BRAND = {
  blue: "#2B3990",
  red: "#D42027",
  gold: "#FFC72C",
};

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [activeTab, setActiveTab] = useState("account"); // "account" or "password"

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setEditFullName(user.fullName || "");
      setEditEmail(user.email || "");
    }
  }, [user]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update password");
      }

      toast.success("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!editFullName.trim() || !editEmail.trim()) {
      toast.error("Full Name and Email are required.");
      return;
    }

    setUpdatingProfile(true);
    try {
      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: editFullName, email: editEmail }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update profile");
      }

      await refreshUser();
      setIsEditing(false);
      toast.success("Profile updated successfully.");
    } catch (err) {
      toast.error(err?.message || "Something went wrong.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const cancelEdit = () => {
    setEditFullName(user?.fullName || "");
    setEditEmail(user?.email || "");
    setIsEditing(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND.blue }}>
          <SettingsIcon size={24} />
          Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your account information and password preferences.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Tabs Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="flex flex-row md:flex-col gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab("account")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === "account"
                  ? "bg-white text-[#2B3990] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User size={18} className="shrink-0" />
              Account Info
            </button>
            <button
              onClick={() => setActiveTab("password")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === "password"
                  ? "bg-white text-[#2B3990] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Shield size={18} className="shrink-0" />
              Password Change
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full min-w-0">
          {activeTab === "account" ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 overflow-hidden">
              <div className="flex items-center justify-between mb-6 border-b pb-4 gap-4 flex-wrap sm:flex-nowrap">
                <h2 className="text-lg font-bold text-slate-800">Account Information</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2B3990] bg-[#2B3990]/10 hover:bg-[#2B3990]/20 transition-all whitespace-nowrap"
                  >
                    <Edit2 size={14} />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all whitespace-nowrap"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                    <button
                      onClick={handleProfileUpdate}
                      disabled={updatingProfile}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2B3990] hover:opacity-90 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      {updatingProfile ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <Check size={14} />
                      )}
                      Save Changes
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Full Name
                    </label>
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border min-h-[48px] ${isEditing ? "bg-white border-[#2B3990] ring-4 ring-[#2B3990]/10" : "bg-slate-50 border-slate-100 text-slate-700"}`}>
                      <User size={18} className={`shrink-0 ${isEditing ? "text-[#2B3990]" : "text-slate-400"}`} />
                      {isEditing ? (
                        <input
                          type="text"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="w-full bg-transparent text-sm font-medium outline-none"
                          placeholder="Enter full name"
                        />
                      ) : (
                        <span className="text-sm font-medium truncate">{user?.fullName || "N/A"}</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Email ID
                    </label>
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border min-h-[48px] ${isEditing ? "bg-white border-[#2B3990] ring-4 ring-[#2B3990]/10" : "bg-slate-50 border-slate-100 text-slate-700"}`}>
                      <Mail size={18} className={`shrink-0 ${isEditing ? "text-[#2B3990]" : "text-slate-400"}`} />
                      {isEditing ? (
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full bg-transparent text-sm font-medium outline-none"
                          placeholder="Enter email address"
                        />
                      ) : (
                        <span className="text-sm font-medium truncate">{user?.email || "N/A"}</span>
                      )}
                    </div>
                  </div>
                </div>

                {user?.departments && user.departments.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Your Departments
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {user.departments.map((dept, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
                          {dept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 overflow-hidden">
              <h2 className="text-lg font-bold mb-6 text-slate-800 border-b pb-4">Change Password</h2>

              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Current Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Key size={18} />
                    </div>
                    <input
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-xl border-slate-200 bg-slate-50/50 py-3 pl-10 pr-10 text-sm transition-all focus:border-[#2B3990] focus:ring-4 focus:ring-[#2B3990]/10 outline-none"
                      placeholder="Enter current password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border-slate-200 bg-slate-50/50 py-3 pl-10 pr-10 text-sm transition-all focus:border-[#2B3990] focus:ring-4 focus:ring-[#2B3990]/10 outline-none"
                      placeholder="Minimum 8 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showNew ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border-slate-200 bg-slate-50/50 py-3 pl-10 pr-10 text-sm transition-all focus:border-[#2B3990] focus:ring-4 focus:ring-[#2B3990]/10 outline-none"
                      placeholder="Repeat new password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 mt-2"
                  style={{ background: BRAND.blue }}
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Update Password
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
