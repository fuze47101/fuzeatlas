"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useI18n } from "@/i18n";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const T = t.verifyEmail;
  const [status, setStatus] = useState<"loading" | "success" | "error" | "resend">("loading");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [resending, setResending] = useState(false);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("resend");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (data.ok) {
          setName(data.name || "");
          setStatus("success");
          setTimeout(() => router.push("/login"), 3000);
        } else {
          setError(data.error || T.errVerifyFailed);
          setStatus("error");
        }
      } catch {
        setError(T.errVerifyFailed);
        setStatus("error");
      }
    };

    verify();
  }, [token, router, T.errVerifyFailed]);

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setError("");
        setStatus("resend");
      } else {
        setError(data.error || T.errSendFailed);
      }
    } catch {
      setError(T.errSendFailed);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">{T.verifyingTitle}</h2>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{T.successTitle}</h2>
            <p className="text-slate-500">
              {name ? `${T.welcomePrefix}, ${name}! ` : ""}{T.successBody}
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{T.failedTitle}</h2>
            <p className="text-slate-500 mb-4">{error}</p>
            <button
              onClick={handleResend}
              disabled={resending}
              className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-semibold hover:bg-[#009ba8] disabled:opacity-50"
            >
              {resending ? T.sendingBtn : T.resendVerificationBtn}
            </button>
          </>
        )}

        {status === "resend" && (
          <>
            <div className="w-16 h-16 bg-[#00b4c3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#00b4c3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{T.checkEmailTitle}</h2>
            <p className="text-slate-500 mb-4">
              {T.checkEmailBody}
            </p>
            <button
              onClick={handleResend}
              disabled={resending}
              className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {resending ? T.sendingBtn : T.resendEmailBtn}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
