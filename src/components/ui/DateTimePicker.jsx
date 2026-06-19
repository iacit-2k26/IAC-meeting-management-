"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, ChevronDown } from "lucide-react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function CustomDropdown({ value, options, onChange, label, width = "w-full" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const [dropdownCoords, setDropdownCoords] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        const dropdownElements = document.querySelectorAll('.custom-time-dropdown');
        for (const el of dropdownElements) {
          if (el.contains(event.target)) return;
        }
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDropdownCoords(null);
      return;
    }
    if (!triggerRef.current) return;
    
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownCoords({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const dropdownContent = dropdownCoords ? (
    <div 
      className="custom-time-dropdown bg-white border border-slate-200 rounded-lg shadow-xl max-h-32 overflow-y-auto"
      style={{ 
        position: 'absolute', 
        top: dropdownCoords.top, 
        left: dropdownCoords.left, 
        width: dropdownCoords.width,
        zIndex: 2147483647
      }}
    >
      {options.map((opt) => (
        <div
          key={opt.value}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onChange(opt.value);
            setIsOpen(false);
          }}
          className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
            String(opt.value) === String(value) ? "bg-[#2B3990] text-white font-bold hover:bg-[#232e74]" : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          {opt.label}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className={`relative ${width}`} ref={dropdownRef}>
      <label className="text-[9px] text-slate-400 font-bold uppercase ml-1 mb-1 block">{label}</label>
      <div
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer hover:border-[#2B3990]/30 transition-all"
      >
        <span>{selectedOption?.label || value}</span>
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
    </div>
  );
}

export default function DateTimePicker({ value, onChange, placeholder = "Select date and time" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("date");
  const [popoverCoords, setPopoverCoords] = useState(null);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  useEffect(() => {
    if (!isOpen) {
      setPopoverCoords(null);
      return;
    }
    if (!triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverH = 340; 
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < popoverH && rect.top > spaceBelow;

      setPopoverCoords(
        openUpward
          ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
          : { top: rect.bottom + 4, left: rect.left, width: rect.width }
      );
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is inside main container
      if (containerRef.current && containerRef.current.contains(event.target)) return;
      
      // Check if click is inside main popover
      const popover = document.getElementById("datetime-picker-popover");
      if (popover && popover.contains(event.target)) return;
      
      // Check if click is inside any custom dropdown (from time picker)
      const customDropdowns = document.querySelectorAll('.custom-time-dropdown');
      for (const dropdown of customDropdowns) {
        if (dropdown.contains(event.target)) return;
      }
      
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDateDisplay = (date) => {
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleDateSelect = (day) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(viewDate.getFullYear());
    newDate.setMonth(viewDate.getMonth());
    newDate.setDate(day);
    updateValue(newDate);
  };

  const handleTimeChange = (type, val) => {
    const newDate = new Date(selectedDate);
    const currentHours = newDate.getHours();
    const isPM = currentHours >= 12;

    if (type === "hour") {
      let h = parseInt(val, 10);
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
      newDate.setHours(h);
    } else if (type === "minute") {
      newDate.setMinutes(parseInt(val, 10));
    } else if (type === "ampm") {
      let h = currentHours % 12;
      if (val === "PM") h += 12;
      newDate.setHours(h);
    }
    updateValue(newDate);
  };

  const updateValue = (date) => {
    setSelectedDate(date);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    const isoString = localDate.toISOString().slice(0, 16);
    onChange({ target: { value: isoString } });
  };

  const changeMonth = (offset) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push(
        <div key={`prev-${i}`} className="h-8 w-8 flex items-center justify-center text-slate-300 text-xs cursor-default">
          {prevMonthDays - i}
        </div>
      );
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const isSelected = selectedDate.getDate() === i &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;
      const isToday = new Date().getDate() === i &&
        new Date().getMonth() === month &&
        new Date().getFullYear() === year;

      cells.push(
        <button
          key={`day-${i}`}
          type="button"
          onClick={() => handleDateSelect(i)}
          className={`h-8 w-8 rounded-md flex items-center justify-center text-xs transition-colors
            ${isSelected ? "bg-[#2B3990] text-white font-bold" :
              isToday ? "bg-slate-100 text-[#2B3990] font-bold border border-[#2B3990]/20" :
              "hover:bg-slate-100 text-slate-700"}`}
        >
          {i}
        </button>
      );
    }

    return cells;
  };

  const popoverContent = popoverCoords ? (
    <div
      id="datetime-picker-popover"
      className="fixed z-[9999] p-4 bg-white border border-slate-200 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.15)]"
      style={{
        top: popoverCoords.top !== undefined ? `${popoverCoords.top}px` : undefined,
        bottom: popoverCoords.bottom !== undefined ? `${popoverCoords.bottom}px` : undefined,
        left: `${popoverCoords.left}px`,
        width: `${popoverCoords.width}px`,
      }}
    >
      <div className="flex flex-col gap-3">
        {step === "date" ? (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold text-slate-800">
                  {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                </h4>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {DAYS.map((day) => (
                  <div key={day} className="h-8 w-8 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                    {day}
                  </div>
                ))}
                {renderCalendar()}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-50">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  updateValue(today);
                  setViewDate(new Date(today));
                }}
                className="text-[10px] font-bold text-[#2B3990] hover:underline"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setStep("time")}
                className="px-4 py-2 bg-[#2B3990] text-white text-xs font-bold rounded-lg hover:bg-[#232e74] transition-colors shadow-sm flex items-center gap-2"
              >
                Next: Set Time <ChevronRight size={14} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="py-2">
              <div className="flex items-center gap-2 mb-4 text-[#2B3990]">
                <Clock size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Select Time</span>
              </div>

              <div className="flex items-center gap-2">
                <CustomDropdown
                  label="Hour"
                  value={selectedDate.getHours() % 12 || 12}
                  options={[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => ({ value: h, label: String(h).padStart(2, "0") }))}
                  onChange={(val) => handleTimeChange("hour", val)}
                  width="flex-1"
                />
                <CustomDropdown
                  label="Min"
                  value={selectedDate.getMinutes()}
                  options={Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2, "0") }))}
                  onChange={(val) => handleTimeChange("minute", val)}
                  width="flex-1"
                />
                <CustomDropdown
                  label="AM/PM"
                  value={selectedDate.getHours() >= 12 ? "PM" : "AM"}
                  options={[{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }]}
                  onChange={(val) => handleTimeChange("ampm", val)}
                  width="w-[70px]"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setStep("date")}
                className="text-[10px] font-bold text-slate-500 hover:underline flex items-center gap-1"
              >
                <ChevronLeft size={12} /> Back to Date
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 bg-[#2B3990] text-white text-xs font-bold rounded-lg hover:bg-[#232e74] transition-colors shadow-md"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        ref={triggerRef}
        onClick={() => {
          if (!isOpen) setStep("date");
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-[#2B3990]/30 transition-all shadow-sm"
      >
        <span className={`text-sm ${!value ? "text-slate-400" : "text-slate-900"}`}>
          {value ? formatDateDisplay(selectedDate) : placeholder}
        </span>
        <CalendarIcon size={16} className="text-slate-400" />
      </div>

      {isOpen && typeof document !== "undefined" && createPortal(popoverContent, document.body)}
    </div>
  );
}
