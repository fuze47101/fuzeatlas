"use client";
import { useState, useRef, useEffect, useCallback } from "react";

export interface SelectOption {
  id: string;
  name: string;
  detail?: string; // secondary line (e.g. country for factory)
}

interface SearchableSelectProps {
  label: string;
  options: SelectOption[];
  value: string | null;         // selected id
  displayValue: string | null;  // selected name to show
  onChange: (id: string | null, name: string | null) => void;
  onCreateNew?: (searchText: string) => void;
  placeholder?: string;
  createLabel?: string;          // e.g. "Brand", "Factory"
}

export default function SearchableSelect({
  label,
  options,
  value,
  displayValue,
  onChange,
  onCreateNew,
  placeholder = "Search...",
  createLabel = "Item",
}: SearchableSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options by search text
  const filtered = search.trim()
    ? options.filter((o) =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        (o.detail && o.detail.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  const visible = filtered.slice(0, 15);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset highlight when filtered changes
  useEffect(() => {
    setHighlightIdx(0);
  }, [search]);

  const handleSelect = useCallback(
    (opt: SelectOption) => {
      onChange(opt.id, opt.name);
      setSearch("");
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClear = () => {
    onChange(null, null);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, visible.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (visible[highlightIdx]) {
          handleSelect(visible[highlightIdx]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>

      {/* Selected value display */}
      {value && displayValue ? (
        <div className="flex items-center gap-2 w-full px-3 py-2.5 border border-green-300 rounded-lg bg-green-50">
          <span className="flex-1 text-sm text-slate-900 truncate">{displayValue}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            title="Clear selection"
          >
            ×
          </button>
        </div>
      ) : (
        /* Search input */
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        />
      )}

      {/* Dropdown */}
      {isOpen && !value && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {visible.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">
              {search ? "No matches found" : "Type to search..."}
            </div>
          )}

          {visible.map((opt, idx) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`w-full text-left px-3 py-2 text-sm ${
                idx === highlightIdx
                  ? "bg-blue-50 text-blue-900"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="font-medium truncate">{opt.name}</div>
              {opt.detail && (
                <div className="text-xs text-slate-500 truncate">{opt.detail}</div>
              )}
            </button>
          ))}

          {filtered.length > 15 && (
            <div className="px-3 py-1.5 text-xs text-slate-400 border-t border-slate-100">
              {filtered.length - 15} more — type to narrow
            </div>
          )}

          {/* Create new button */}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(search);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 border-t border-slate-200 flex items-center gap-1.5"
            >
              <span className="text-lg leading-none">+</span>
              Create New {createLabel}
              {search && <span className="text-blue-400 ml-1">&quot;{search}&quot;</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
