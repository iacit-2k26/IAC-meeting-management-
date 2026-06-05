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

  const handleOpen = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
      zIndex: 9999,
    });
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [open]);

  const dropdown = (
    <div
      style={dropdownStyle}
      className="bg-white border border-slate-200 shadow-xl rounded-lg py-1 max-h-60 overflow-y-auto"
    >
      {options.map((opt) => (
        <div
          key={opt.value}
          onMouseDown={(event) => {
            event.preventDefault();
            if (opt.value === "") return;
            onChange(opt.value);
            setOpen(false);
          }}
          className={`px-3 py-2 text-sm cursor-pointer transition-colors select-none
            ${opt.value === value
              ? "bg-[#2B3990]/10 text-[#2B3990] font-semibold"
              : opt.value === ""
              ? "text-slate-400 italic cursor-default"
              : "text-slate-700 hover:bg-slate-50"
            }`}
        >
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
        style={{ minWidth }}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm border rounded-md bg-white w-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B3990]/20
          ${disabled
            ? "border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
            : "border-slate-300 text-slate-700 hover:border-[#2B3990] cursor-pointer"
          }`}
      >
        <span className={selected && selected.value !== "" ? "text-slate-800" : "text-slate-400"}>
          {selected && selected.value !== "" ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {typeof document !== "undefined" && open && createPortal(dropdown, document.body)}
    </>
  );
}
