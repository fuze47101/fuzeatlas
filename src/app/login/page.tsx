"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Setup mode — first user registration
  const [isSetup, setIsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupChecked, setSetupChecked] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = searchParams.get("from") || "/dashboard";
      router.push(from);
    }
  }, [user, router, searchParams]);

  // Check if this is first-time setup
  useEffect(() => {
    fetch("/api/auth/setup-check")
      .then((r) => r.json())
      .then((d) => {
        setIsSetup(d.needsSetup === true);
        setSetupChecked(true);
      })
      .catch(() => setSetupChecked(true));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    if (!result.ok) {
      setError(result.error || "Login failed");
    } else {
      const from = searchParams.get("from") || "/dashboard";
      router.push(from);
    }
    setLoading(false);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: setupName, email, password }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Setup failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading...</div>
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
            {isSetup ? "Create your admin account to get started" : "Textile Intelligence Platform"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            {isSetup ? "Initial Setup" : "Sign In"}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={isSetup ? handleSetup : handleLogin} className="space-y-4">
            {isSetup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                  placeholder="Andrew Chen"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                placeholder="you@801inc.com"
                required
                autoFocus
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                {!isSetup && (
                  <a href="/forgot-password" className="text-xs text-[#00b4c3] hover:underline">
                    Forgot password?
                  </a>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                placeholder={isSetup ? "Choose a password (6+ chars)" : "Enter your password"}
                required
                minLength={isSetup ? 6 : 1}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-2.5 rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Please wait..."
                : isSetup
                ? "Create Admin Account"
                : "Sign In"}
            </button>
          </form>

          {isSetup && (
            <p className="mt-4 text-xs text-slate-500 text-center">
              This creates the first admin account. You can add more users later from Settings.
            </p>
          )}

          {!isSetup && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                Brand partner?{" "}
                <a href="/request-access" className="text-[#00b4c3] hover:underline font-medium">
                  Request portal access
                </a>
              </p>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
