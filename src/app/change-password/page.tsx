"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForced, setIsForced] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    // Check if this is a forced password change
    const checkForced = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.ok && data.user?.mustChangePassword) {
          setIsForced(true);
        }
      } catch {}
    };
    checkForced();
  }, [user, router]);

  const getDefaultRoute = (role?: string) => {
    if (role === "FACTORY_USER" || role === "FACTORY_MANAGER") return "/factory-portal";
    if (role === "BRAND_USER" || role === "BRAND_MANAGER") return "/brand-portal";
    if (role === "DISTRIBUTOR_USER") return "/distributor-portal";
    return "/dashboard";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: isForced ? undefined : currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push(getDefaultRoute(user?.role));
        }, 2000);
      } else {
        setError(data.error || "Failed to change password");
      }
    } catch {
      setError("Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Password Updated</h2>
          <p className="text-slate-500">Redirecting you now...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#00b4c3]/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#00b4c3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            {isForced ? "Set Your New Password" : "Change Password"}
          </h1>
          {isForced && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              You were assigned a temporary password. Please create a secure password to continue.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password (only if not forced) */}
          {!isForced && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
            />
          </div>

          {/* Password requirements */}
          <div className="text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-2">
              <span className={newPassword.length >= 8 ? "text-emerald-600" : ""}>
                {newPassword.length >= 8 ? "✓" : "○"} At least 8 characters
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={/[A-Z]/.test(newPassword) ? "text-emerald-600" : ""}>
                {/[A-Z]/.test(newPassword) ? "✓" : "○"} One uppercase letter
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={/[0-9]/.test(newPassword) ? "text-emerald-600" : ""}>
                {/[0-9]/.test(newPassword) ? "✓" : "○"} One number
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={newPassword && newPassword === confirmPassword ? "text-emerald-600" : ""}>
                {newPassword && newPassword === confirmPassword ? "✓" : "○"} Passwords match
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-bold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50"
          >
            {loading ? "Updating..." : isForced ? "Set Password & Continue" : "Update Password"}
          </button>

          {!isForced && (
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full py-2 text-slate-500 text-sm hover:text-slate-700"
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
