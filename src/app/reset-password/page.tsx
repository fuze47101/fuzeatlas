"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token");
    }
  }, [token]);

  const validatePassword = (pass: string) => {
    if (pass.length < 6) {
      return "Password must be at least 6 characters";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPasswordError("");

    // Validate passwords
    const pwError = validatePassword(password);
    if (pwError) {
      setPasswordError(pwError);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid reset token");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch {
      setError("Network error");
    }

    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Invalid Reset Link
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              The reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white px-6 py-2.5 rounded-lg font-medium text-sm"
            >
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00b4c3] to-[#009ba8] flex items-center justify-center text-white font-black text-lg shadow-lg">
              F
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              FUZE Atlas
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Create a new password
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!submitted ? (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                Reset Password
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="Enter new password"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="Confirm password"
                    required
                  />
                </div>

                {passwordError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    {passwordError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-2.5 rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <p className="text-sm text-slate-600">
                  <Link href="/login" className="text-[#00b4c3] hover:underline font-medium">
                    Back to Sign In
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-6 h-6 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Password Reset Successful
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Link
                href="/login"
                className="inline-block bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white px-6 py-2.5 rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>

        <p className="text-center mt-6 text-xs text-slate-500">
          FUZE Biotech Inc. &middot; v0.5.0
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="text-slate-400 text-sm">Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
