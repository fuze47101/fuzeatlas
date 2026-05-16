"use client";

/**
 * /factory-portal/intake/voice — Phase 11H.
 *
 * Tap-to-dictate fabric intake. Browser-native SpeechRecognition
 * (Chrome / Safari / mobile WebKit). On unsupported browsers shows
 * a "use Chrome on your phone" fallback message.
 *
 * Whisper fallback (cloud) is noted in code comments — actual
 * implementation deferred since OPENAI_API_KEY may not be set.
 * Web Speech API covers iOS Safari + Android Chrome which is the
 * vast majority of factory-floor mobile traffic.
 *
 * Flow:
 *   1. Tap mic → start SpeechRecognition; live transcript renders
 *   2. Tap "Parse" → POST /api/factory-portal/intake/voice
 *      → Claude haiku-4-5 returns structured fields + clarifying Qs
 *   3. User reviews + edits → Submit calls existing
 *      /api/factory-portal/intake POST
 */

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";

interface ParsedFields {
  fabricName?: string | null;
  weightGsm?: number | null;
  widthInches?: number | null;
  fiberContent?: string | null;
  supplier?: string | null;
  notes?: string | null;
}

interface ParseResponse {
  ok: boolean;
  fields: ParsedFields;
  clarifyingQuestions: string[];
  transcriptLanguage: string;
}

export default function VoiceIntakePage() {
  const { t } = useI18n();
  const tx = t.factoryPortal.voiceIntake;
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [language] = useState("en-US");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [fields, setFields] = useState<ParsedFields>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = language;
    r.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript + " ";
      }
      setTranscript(text.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = (e: any) => {
      setError(`Voice error: ${e.error || "unknown"}`);
      setListening(false);
    };
    recognitionRef.current = r;
    return () => {
      try {
        r.stop();
      } catch {}
    };
  }, [language]);

  function toggle() {
    const r = recognitionRef.current;
    if (!r) return;
    setError(null);
    if (listening) {
      r.stop();
      setListening(false);
    } else {
      setTranscript("");
      setParsed(null);
      setFields({});
      setSubmitDone(false);
      try {
        r.start();
        setListening(true);
      } catch (e: any) {
        setError(e?.message || "Could not start recognition");
      }
    }
  }

  async function parse() {
    if (!transcript.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/factory-portal/intake/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, language }),
      });
      const j = await res.json();
      if (!j.ok) setError(j.error || "Parse failed");
      else {
        setParsed(j);
        setFields(j.fields || {});
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/factory-portal/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricName: fields.fabricName,
          weightGsm: fields.weightGsm,
          width: fields.widthInches,
          fiberContent: fields.fiberContent,
          supplier: fields.supplier,
          notes: fields.notes,
          source: "voice-intake",
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Submit failed");
      } else {
        setSubmitDone(true);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (supported === false) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-600">
          This browser doesn't support voice dictation. Open this page in Chrome
          (Android) or Safari (iOS) on your phone.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-black text-slate-900 mb-2">{tx.pageTitle}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Tap the mic, dictate the fabric details, then tap Parse. The system
        extracts the fields for you to review.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col items-center mb-6">
        <button
          onClick={toggle}
          className={`w-32 h-32 rounded-full text-5xl shadow-xl transition-all ${
            listening
              ? "bg-red-500 text-white animate-pulse"
              : "bg-[#00b4c3] text-white hover:bg-[#009aa8]"
          }`}
        >
          🎤
        </button>
        <p className="text-xs text-slate-500 mt-2">
          {listening ? "Listening… tap to stop" : "Tap to start"}
        </p>
      </div>

      {transcript && (
        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs font-bold uppercase text-slate-500 mb-1">Transcript</p>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{transcript}</p>
          <button
            onClick={parse}
            disabled={parsing}
            className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {parsing ? "Parsing with AI…" : "Parse →"}
          </button>
        </div>
      )}

      {parsed && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="font-bold text-slate-900">Review & submit</h2>
          {parsed.clarifyingQuestions.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-bold text-amber-900 mb-1">AI couldn't fill these:</p>
              <ul className="text-xs text-amber-800 list-disc pl-4">
                {parsed.clarifyingQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {[
            { key: "fabricName", label: "Fabric name", type: "text" },
            { key: "weightGsm", label: "Weight (GSM)", type: "number" },
            { key: "widthInches", label: "Width (inches)", type: "number" },
            { key: "fiberContent", label: "Fiber content", type: "text" },
            { key: "supplier", label: "Supplier", type: "text" },
            { key: "notes", label: "Notes", type: "textarea" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  value={(fields as any)[f.key] || ""}
                  onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              ) : (
                <input
                  type={f.type}
                  value={(fields as any)[f.key] ?? ""}
                  onChange={(e) =>
                    setFields({
                      ...fields,
                      [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              )}
            </div>
          ))}
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full px-4 py-3 bg-[#00b4c3] text-white rounded text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit intake"}
          </button>
        </div>
      )}

      {submitDone && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-lg font-bold text-emerald-900">✓ Submitted</p>
          <p className="text-sm text-emerald-800 mt-1">
            Fabric intake created. Check /factory-portal/submissions for status.
          </p>
        </div>
      )}
    </div>
  );
}
