"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export default function CustomSelect({
  value,
  onChange,
  options = [],
  minWidth = "160px",
  placeholder = "Select...",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const triggerRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const reposition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownMaxH = 240;

    const openUpward = spaceBelow < dropdownMaxH && spaceAbove > spaceBelow;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const handleOpen = () => {
    if (disabled) return;
    if (!open) reposition();
    setOpen((prev) => !prev);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reposition on any scroll (but don't close)
  useEffect(() => {
    if (!open) return;
    const handler = () => reposition();
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  // Reposition on resize
  useEffect(() => {
    if (!open) return;
    const handler = () => reposition();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const dropdown = (
    <div
      style={{ ...dropdownStyle, maxHeight: 240 }}
      className="bg-white border border-slate-200 shadow-2xl rounded-xl py-1 overflow-y-auto"
    >
      {options.map((opt) => (
        <div
          key={opt.value}
          onMouseDown={(e) => {
            e.preventDefault();
            if (opt.disabled) return;
            onChange(opt.value);
            setOpen(false);
          }}
          className={`px-3 py-2 text-sm cursor-pointer transition-colors select-none flex items-center gap-2
            ${opt.value === value
              ? "bg-[#2B3990]/10 text-[#2B3990] font-semibold"
              : opt.disabled
              ? "text-slate-300 cursor-not-allowed"
              : "text-slate-700 hover:bg-slate-50"
            }`}
        >
          {opt.value === value && (
            <span className="w-1.5 h-1.5 shrink-0" />
          )}
          {opt.value !== value && <span className="w-1.5 shrink-0" />}
          {opt.label}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-xl bg-white w-full transition-all focus:outline-none focus:ring-2 focus:ring-[#2B3990]/20
          ${open ? "border-[#2B3990] ring-2 ring-[#2B3990]/15" : "border-slate-200"}
          ${disabled
            ? "text-slate-400 cursor-not-allowed opacity-60"
            : "text-slate-700 hover:border-[#2B3990]/50 cursor-pointer"
          }`}
      >
        <span className={selected && selected.value !== "" ? "text-slate-800" : "text-slate-400 italic"}>
          {selected && selected.value !== "" ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {typeof document !== "undefined" && open && createPortal(dropdown, document.body)}
    </>
  );
}
