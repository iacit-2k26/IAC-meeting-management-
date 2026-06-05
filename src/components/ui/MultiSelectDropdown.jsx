"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

export default function MultiSelectDropdown({
  options,
  selectedValues,
  onToggle,
  onClear,
  allLabel = "All",
  placeholder = "Select...",
  className = "",
  icon: Icon,
  minWidth = "0px",
  menuMinWidthClass = "min-w-[220px]",
  optionLabelClassName = "",
  enableSearch = false,
  searchPlaceholder = "Search...",
  searchMode = "includes",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const closeMenu = () => {
    setIsOpen(false);
    setSearchQuery("");
  };

  const normalizedSearchQuery = String(searchQuery || "").trim().toLowerCase();
  const filteredOptions = options.filter((opt) => {
    if (!normalizedSearchQuery) return true;
    const label = String(opt?.label || "").toLowerCase();
    if (searchMode === "startsWith") {
      return label.startsWith(normalizedSearchQuery);
    }
    return label.includes(normalizedSearchQuery);
  });

  const updateMenuStyle = () => {
    if (!buttonRef.current || typeof window === "undefined") return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const spaceAbove = rect.top - viewportPadding;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const listMaxHeight = Math.max(120, Math.min(280, availableSpace - 56));

    const desiredLeft = rect.left;
    const minMenuWidth = Math.max(rect.width, 220);
    const clampedLeft = Math.max(
      viewportPadding,
      Math.min(desiredLeft, window.innerWidth - minMenuWidth - viewportPadding)
    );

    const top = openAbove
      ? Math.max(viewportPadding, rect.top - (listMaxHeight + 54) - 4)
      : Math.min(window.innerHeight - viewportPadding, rect.bottom + 4);

    setMenuStyle({
      top,
      left: clampedLeft,
      width: Math.max(rect.width, 220),
      listMaxHeight,
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    updateMenuStyle();

    const onClickOutside = (event) => {
      const target = event.target;
      const clickedTrigger = wrapRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedTrigger && !clickedMenu) {
        closeMenu();
      }
    };

    const onViewportChange = (event) => {
      if (menuRef.current?.contains(event?.target)) return;
      updateMenuStyle();
    };

    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [isOpen]);

  const label = selectedValues.length === 0
    ? allLabel
    : selectedValues.length === 1
      ? options.find((opt) => opt.value === selectedValues[0])?.label || selectedValues[0]
      : `${selectedValues.length} selected`;

  return (
    <div className={`relative ${className}`} ref={wrapRef} style={{ minWidth }}>
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }
          setIsOpen(true);
        }}
        ref={buttonRef}
        className="w-full flex items-center justify-between gap-2 pl-2 pr-1.5 py-1.5 rounded-lg text-xs bg-white border border-slate-200 text-slate-700 hover:border-[#2B3990]/50 focus:border-[#2B3990] focus:ring-1 focus:ring-[#2B3990]/10 transition-all outline-none h-[36px]"
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && <Icon size={14} className="text-slate-400 shrink-0" />}
          <span className="truncate">{label}</span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && menuStyle && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className={`fixed z-[70] ${menuMinWidthClass} bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 origin-top p-2`}
          style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
        >
          {enableSearch && (
            <div className="mb-2 px-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-[#2B3990] focus:ring-1 focus:ring-[#2B3990]/10 bg-white"
              />
            </div>
          )}

          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={onClear}
              className="text-[12px] font-semibold text-[#2B3990] hover:text-[#232e74] transition-colors"
            >
              {allLabel}
            </button>
            <button
              type="button"
              onClick={closeMenu}
              className="text-[12px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Close
            </button>
          </div>

          <div className="overflow-y-auto space-y-0.5 pr-1 custom-scrollbar" style={{ maxHeight: `${menuStyle.listMaxHeight}px` }}>
            {filteredOptions.map((opt) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors cursor-pointer
                    ${isSelected ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(opt.value)}
                    className="h-4 w-4 rounded border-slate-300 text-[#2B3990] focus:ring-[#2B3990]/20 transition-all cursor-pointer"
                  />
                  <span className={`text-[13px] text-slate-700 whitespace-normal break-words leading-tight ${optionLabelClassName}`} title={opt.label}>
                    {opt.label}
                  </span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && (
              <p className="px-2 py-2 text-xs text-slate-400">No matches found.</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
