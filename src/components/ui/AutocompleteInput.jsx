"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  onSubmit,
  options = [],
  placeholder = "Type name or email",
  emptyText = "No matches found.",
  buttonLabel = "Add",
  className = "",
  minWidth = "210px",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const skipNextFocusOpenRef = useRef(false);
  const notifyTimerRef = useRef(null);

  useEffect(() => () => {
    if (notifyTimerRef.current) {
      clearTimeout(notifyTimerRef.current);
    }
  }, []);

  const normalizedValue = String(inputValue || "").trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedValue) return options.slice(0, 20);

    const results = [];
    for (const option of options) {
      const searchText = String(option?.searchText || `${option?.label || ""} ${option?.email || ""}`).toLowerCase();
      if (!searchText.includes(normalizedValue)) continue;
      results.push(option);
      if (results.length >= 20) break;
    }
    return results;
  }, [normalizedValue, options]);

  const openDropdown = () => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom);
    const spaceAbove = Math.max(0, rect.top);
    const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(280, openUpward ? spaceAbove - 12 : spaceBelow - 12));

    setDropdownStyle({
      position: "fixed",
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 9999,
    });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      const clickedInsideWrap = wrapRef.current?.contains(event.target);
      if (!clickedInsideWrap) setIsOpen(false);
    };

    const closeOnScrollOrResize = () => setIsOpen(false);

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", closeOnScrollOrResize, true);
    window.addEventListener("resize", closeOnScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", closeOnScrollOrResize, true);
      window.removeEventListener("resize", closeOnScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={wrapRef} style={{ minWidth }}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setInputValue(nextValue);
              if (notifyTimerRef.current) {
                clearTimeout(notifyTimerRef.current);
              }
              notifyTimerRef.current = setTimeout(() => {
                onChange?.(nextValue);
              }, 120);
              openDropdown();
            }}
            onFocus={() => {
              if (skipNextFocusOpenRef.current) {
                skipNextFocusOpenRef.current = false;
                return;
              }
              openDropdown();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit?.(inputValue);
                return;
              }
              if (event.key === "Escape") {
                setIsOpen(false);
              }
            }}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 rounded-md border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2B3990]/20 focus:border-[#2B3990]"
          />

          {typeof document !== "undefined" && isOpen && createPortal(
            <div style={dropdownStyle} className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden p-1">
              <div className="max-h-56 overflow-y-auto py-1 custom-scrollbar space-y-0.5">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const label = String(option?.label || "").trim();
                    const email = String(option?.email || "").trim();
                    return (
                      <button
                        key={`${label}-${email}`}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setInputValue(label);
                          onChange?.(label);
                          onSelect?.(option);
                          setIsOpen(false);
                          skipNextFocusOpenRef.current = true;
                          inputRef.current?.focus();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <div className="font-medium truncate">{label}</div>
                        <div className="text-[11px] text-slate-500 truncate">{email}</div>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-xs text-slate-400">{emptyText}</p>
                )}
              </div>
            </div>,
            document.body
          )}
        </div>

        <button
          type="button"
          onClick={() => onSubmit?.(inputValue)}
          className="px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          {buttonLabel}
        </button>
      </div>

      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setIsOpen((prev) => !prev)}
        className="absolute right-16 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      >
        <ChevronDown size={14} className={isOpen ? "rotate-180" : ""} />
      </button>
    </div>
  );
}
