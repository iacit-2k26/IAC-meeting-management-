"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// value / onChange use "YYYY-MM-DD" strings
export default function DatePicker({ value, onChange, placeholder = "Select date" }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({});
  const triggerRef = useRef(null);

  const parsed = value ? new Date(value + "T00:00:00") : null;
  const today = new Date();

  const [viewYear, setViewYear] = useState((parsed || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed || today).getMonth());

  const reposition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setCoords(
      spaceBelow < 300
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left }
        : { top: rect.bottom + 4, left: rect.left }
    );
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    const onResize = () => reposition();
    const onMouse = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) {
        const pop = document.getElementById("datepicker-pop");
        if (pop && pop.contains(e.target)) return;
        setOpen(false);
      }
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onMouse);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open]);

  const handleOpen = () => {
    reposition();
    setOpen((p) => !p);
  };

  const selectDay = (day) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push(<div key={`p${i}`} className="h-8 w-8 flex items-center justify-center text-slate-300 text-xs">{prevDays - i}</div>);
  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected = parsed && parsed.getDate() === d && parsed.getMonth() === viewMonth && parsed.getFullYear() === viewYear;
    const isToday = today.getDate() === d && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
    cells.push(
      <button key={d} type="button" onClick={() => selectDay(d)}
        className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors
          ${isSelected ? "bg-[#2B3990] text-white font-bold"
          : isToday ? "bg-slate-100 text-[#2B3990] font-bold border border-[#2B3990]/30"
          : "hover:bg-slate-100 text-slate-700"}`}>
        {d}
      </button>
    );
  }

  const displayValue = parsed
    ? parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  const popoverWidth = 280;
  const getPopoverLeft = () => {
    if (coords.left === undefined) return undefined;
    if (typeof window === "undefined") return coords.left;
    return Math.max(12, Math.min(coords.left, window.innerWidth - popoverWidth - 12));
  };

  const popover = (
    <div id="datepicker-pop"
      style={{
        position: "fixed",
        zIndex: 99999,
        width: popoverWidth,
        ...coords,
        left: getPopoverLeft() !== undefined ? `${getPopoverLeft()}px` : undefined
      }}
      className="bg-white border border-slate-200 rounded-xl shadow-2xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-bold text-slate-800">{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronRight size={15} />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1 justify-items-center">
        {DAYS.map((d) => (
          <div key={d} className="h-8 w-8 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-0.5 justify-items-center">{cells}</div>
      {/* Footer */}
      <div className="mt-3 flex justify-between items-center border-t border-slate-100 pt-2">
        <button type="button" onClick={() => { onChange(""); setOpen(false); }}
          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors">
          Clear
        </button>
        <button type="button" onClick={() => {
          const t = new Date();
          const m = String(t.getMonth() + 1).padStart(2, "0");
          const d = String(t.getDate()).padStart(2, "0");
          onChange(`${t.getFullYear()}-${m}-${d}`);
          setOpen(false);
        }} className="text-[10px] font-bold text-[#2B3990] hover:underline transition-colors">
          Today
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        className="flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-xl bg-white w-full transition-all focus:outline-none hover:border-[#2B3990]/50 border-slate-200 text-slate-700 cursor-pointer">
        <span className={displayValue ? "text-slate-800" : "text-slate-400 italic"}>{displayValue || placeholder}</span>
        <CalendarIcon size={14} className="text-slate-400 shrink-0" />
      </button>
      {typeof document !== "undefined" && open && createPortal(popover, document.body)}
    </>
  );
}
