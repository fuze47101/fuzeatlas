"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED = [
  { q: "What FUZE tiers are available?", icon: "🧪" },
  { q: "Is FUZE safe for baby products?", icon: "👶" },
  { q: "How much does treatment cost per meter?", icon: "💰" },
  { q: "What testing standards does FUZE meet?", icon: "📋" },
  { q: "How do we get started with FUZE?", icon: "🚀" },
  { q: "Is FUZE environmentally friendly?", icon: "🌿" },
  { q: "Can FUZE be applied to polyester?", icon: "🧵" },
  { q: "Does FUZE work against viruses?", icon: "🦠" },
];

export default function BrandChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply, timestamp: new Date() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I encountered an error. Please try again.", timestamp: new Date() },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Unable to connect. Please check your connection.", timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  function renderContent(content: string) {
    return content.split("\n").map((line, i) => {
      let rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (rendered.startsWith("- ")) {
        return (
          <div key={i} className="flex gap-2 ml-3 my-0.5">
            <span className="text-[#00b4c3] mt-0.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: rendered.slice(2) }} />
          </div>
        );
      }
      const numMatch = rendered.match(/^(\d+)\.\s/);
      if (numMatch) {
        return (
          <div key={i} className="flex gap-2 ml-3 my-0.5">
            <span className="text-[#00b4c3] font-semibold min-w-[1.4rem]">{numMatch[1]}.</span>
            <span dangerouslySetInnerHTML={{ __html: rendered.slice(numMatch[0].length) }} />
          </div>
        );
      }
      if (rendered.trim() === "") return <br key={i} />;
      return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: rendered }} />;
    });
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00b4c3] to-[#0090a0] flex items-center justify-center text-white text-xl font-bold shadow-lg">
          F
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">FUZE AI Assistant</h1>
          <p className="text-sm text-slate-500">Ask anything about FUZE antimicrobial technology</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00b4c3] to-[#0090a0] mx-auto flex items-center justify-center text-4xl text-white mb-5 shadow-xl">
                F
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">
                Hi! I&apos;m FUZE AI
              </h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto">
                I&apos;m trained on FUZE&apos;s complete product documentation. Ask me about antimicrobial tiers, testing standards, pricing, safety certifications, application methods, and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {SUGGESTED.map((item) => (
                  <button
                    key={item.q}
                    onClick={() => sendMessage(item.q)}
                    className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-[#00b4c3] hover:text-[#00b4c3] hover:shadow-md transition-all text-left"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-3`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00b4c3] to-[#0090a0] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
                  F
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#00b4c3] text-white rounded-br-md"
                    : "bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
                  You
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00b4c3] to-[#0090a0] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
                F
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00b4c3] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00b4c3] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00b4c3] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="border-t border-slate-200 bg-white px-4 sm:px-8 py-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question about FUZE products..."
              className="flex-1 px-5 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#00b4c3] focus:ring-2 focus:ring-[#00b4c3]/20 bg-slate-50"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-6 py-3 rounded-xl bg-[#00b4c3] text-white font-medium text-sm hover:bg-[#0090a0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span>Send</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            FUZE AI is powered by product documentation. For specific contract or order inquiries, contact your sales representative.
          </p>
        </form>
      </div>
    </div>
  );
}
