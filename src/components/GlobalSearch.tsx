"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
};

const TYPE_ICONS: Record<string, string> = {
  brand: "🔥",
  factory: "🏭",
  fabric: "🧵",
  lab: "🔬",
  contact: "👤",
  test: "🧪",
};

const TYPE_LABELS: Record<string, string> = {
  brand: "Brands",
  factory: "Factories",
  fabric: "Fabrics",
  lab: "Labs",
  contact: "Contacts",
  test: "Tests",
};

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 250);
  };

  const navigate = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].url);
    }
  };

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  // Flat list for keyboard nav index tracking
  let flatIndex = 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <svg
            className="w-5 h-5 text-slate-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search brands, factories, fabrics, labs, contacts, tests..."
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-slate-300 border-t-[#00b4c3] rounded-full animate-spin" />
          )}
          <kbd className="hidden sm:inline-flex text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {query.length < 2 && !loading && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              Type at least 2 characters to search...
            </div>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/80 sticky top-0">
                {TYPE_LABELS[type] || type}
              </div>
              {items.map((item) => {
                const idx = flatIndex++;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.url)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-[#00b4c3]/10 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-base flex-shrink-0">
                      {TYPE_ICONS[item.type] || "📄"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <kbd className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
            <span>
              <kbd className="bg-slate-100 px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="bg-slate-100 px-1 py-0.5 rounded font-mono">↵</kbd> open
            </span>
            <span>
              <kbd className="bg-slate-100 px-1 py-0.5 rounded font-mono">esc</kbd> close
            </span>
            <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
    </div>
  );
}
