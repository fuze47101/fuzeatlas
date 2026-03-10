"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "What are the FUZE tiers?",
  "Is FUZE safe for baby products?",
  "How much does FUZE treatment cost?",
  "What tests does FUZE pass?",
  "Is FUZE PFAS-free?",
  "How do we get started?",
];

export default function FuzeChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
      setHasNewMessage(false);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: text.trim(),
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (!isOpen) setHasNewMessage(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error. Please try again.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Unable to connect. Please check your connection and try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Simple markdown-ish rendering
  function renderContent(content: string) {
    return content.split("\n").map((line, i) => {
      // Bold
      let rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Bullet points
      if (rendered.startsWith("- ")) {
        return (
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-[#00b4c3] mt-0.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: rendered.slice(2) }} />
          </div>
        );
      }
      // Numbered lists
      const numMatch = rendered.match(/^(\d+)\.\s/);
      if (numMatch) {
        return (
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-[#00b4c3] font-medium min-w-[1.2rem]">{numMatch[1]}.</span>
            <span dangerouslySetInnerHTML={{ __html: rendered.slice(numMatch[0].length) }} />
          </div>
        );
      }
      // Regular text
      if (rendered.trim() === "") return <br key={i} />;
      return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: rendered }} />;
    });
  }

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-[100] w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ height: "min(580px, calc(100vh - 140px))" }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-4 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#00b4c3] flex items-center justify-center text-lg font-bold shadow-lg">
              F
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">FUZE AI Assistant</h3>
              <p className="text-[11px] text-slate-400">Antimicrobial product knowledge</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Direct Contact Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200 flex-shrink-0">
            <span className="text-[10px] text-slate-500 font-medium">Prefer to talk to a human?</span>
            <div className="flex items-center gap-3">
              <a href="tel:+18017107222" className="flex items-center gap-1 text-[11px] font-semibold text-[#00b4c3] hover:text-[#0090a0] transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call Us
              </a>
              <a href="https://fuzeatlas.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-[#00b4c3] hover:text-[#0090a0] transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
                Website
              </a>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00b4c3] to-[#0090a0] mx-auto flex items-center justify-center text-2xl text-white mb-3 shadow-lg">
                  F
                </div>
                <h4 className="font-semibold text-slate-800 text-sm mb-1">Welcome to FUZE AI</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Ask me anything about FUZE antimicrobial technology, testing, pricing, or safety.
                </p>
                <div className="space-y-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="block w-full text-left px-3 py-2 text-xs bg-white rounded-lg border border-slate-200 text-slate-600 hover:border-[#00b4c3] hover:text-[#00b4c3] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#00b4c3] text-white rounded-br-md"
                      : "bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#00b4c3] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-[#00b4c3] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-[#00b4c3] animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about FUZE products..."
                className="flex-1 px-4 py-2.5 rounded-full border border-slate-300 text-sm focus:outline-none focus:border-[#00b4c3] focus:ring-2 focus:ring-[#00b4c3]/20 bg-slate-50"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-full bg-[#00b4c3] text-white flex items-center justify-center hover:bg-[#0090a0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 sm:right-6 z-[100] w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isOpen
            ? "bg-slate-800 text-white rotate-0"
            : "bg-gradient-to-br from-[#00b4c3] to-[#0090a0] text-white"
        }`}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {hasNewMessage && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
            )}
          </>
        )}
      </button>
    </>
  );
}
