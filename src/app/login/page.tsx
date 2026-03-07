"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [faqQuery, setFaqQuery] = useState("");

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

  const handleFaqSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (faqQuery.trim()) {
      router.push(`/brand-portal/chat?q=${encodeURIComponent(faqQuery.trim())}`);
    }
  };

  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* ── Top Logo Bar ── */}
      <div className="w-full py-6 flex justify-center">
        <div className="flex items-center gap-3">
          <Image
            src="/fuze-logo-horizontal-light.png"
            alt="FUZE Biotech"
            width={200}
            height={56}
            className="h-12 w-auto"
            priority
          />
        </div>
      </div>

      {/* ── Tagline ── */}
      <div className="text-center mb-8">
        <p className="text-slate-400 text-sm tracking-wide">
          Antimicrobial Textile Intelligence Platform
        </p>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-6">

          {/* ── LEFT: Login Card ── */}
          <div className="lg:w-[420px] flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-1">
                {isSetup ? "Initial Setup" : "Sign In"}
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                {isSetup ? "Create your admin account to get started" : "Existing users — sign in to your account"}
              </p>

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
                    placeholder="you@company.com"
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
            </div>
          </div>

          {/* ── RIGHT: New User Actions ── */}
          {!isSetup && (
            <div className="flex-1 flex flex-col gap-4">
              {/* Brand Access Card */}
              <a
                href="/request-access"
                className="group block bg-gradient-to-br from-slate-800 to-slate-800/80 border border-slate-700 rounded-2xl p-6 hover:border-[#00b4c3] hover:shadow-lg hover:shadow-[#00b4c3]/10 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00b4c3] to-[#009ba8] flex items-center justify-center text-2xl flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                    🏢
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-[#00b4c3] transition-colors">
                      Brand Partner Access
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                      Are you a brand looking for antimicrobial textile solutions? Request access to view your fabrics, test results, and manage your FUZE program.
                    </p>
                    <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[#00b4c3]">
                      Request Brand Access
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </a>

              {/* Factory Access Card */}
              <a
                href="/request-factory-access"
                className="group block bg-gradient-to-br from-slate-800 to-slate-800/80 border border-slate-700 rounded-2xl p-6 hover:border-[#00b4c3] hover:shadow-lg hover:shadow-[#00b4c3]/10 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                    🏭
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                      Factory / Mill Access
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                      Are you a textile mill or factory partner? Register to submit fabrics, request FUZE testing, track results, and manage your production.
                    </p>
                    <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-amber-400">
                      Request Factory Access
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              </a>

              {/* FAQ Search Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg">
                    💬
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">
                      FUZE FAQ &amp; Knowledge Base
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 mb-3">
                      Have questions about FUZE antimicrobial technology? Search our knowledge base.
                    </p>
                    <form onSubmit={handleFaqSearch} className="flex gap-2">
                      <input
                        type="text"
                        value={faqQuery}
                        onChange={(e) => setFaqQuery(e.target.value)}
                        placeholder="e.g. How does silver nanoparticle bonding work?"
                        className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                      >
                        Search
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          FUZE Biotech Inc. &middot; Antimicrobial Textile Solutions &middot; v0.5.0
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
