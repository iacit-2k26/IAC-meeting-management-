"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, X, Video, MapPin, Users,
  Clock, ExternalLink, Calendar, RefreshCw,
} from "lucide-react";
import { formatDescription } from "@/lib/formatters";

// ─── Constants ───────────────────────────────────────────────────────────────
const DAYS_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const HOUR_PX     = 64; // height of one hour row in px (week view)
const START_HOUR  = 0;  // show from midnight
const END_HOUR    = 24;

// Professional limited colour palette
const THEME_COLORS = {
  blue   : "#2B3990", // Deeper corporate blue (matching system brand)
  indigo : "#3F4E9F", // Slightly lighter indigo for contrast
  slate  : "#475569", // Deeper slate for neutral events
};

// Map Google Calendar colorIds to our limited theme
const GCal_COLORS = {
  default : THEME_COLORS.blue,
  "1"     : THEME_COLORS.indigo, // lavender -> indigo
  "2"     : THEME_COLORS.blue,   // sage -> blue
  "3"     : THEME_COLORS.indigo, // grape -> indigo
  "4"     : THEME_COLORS.blue,   // flamingo -> blue
  "5"     : THEME_COLORS.indigo, // banana -> indigo
  "6"     : THEME_COLORS.blue,   // tangerine -> blue
  "7"     : THEME_COLORS.indigo, // peacock -> indigo
  "8"     : THEME_COLORS.slate,  // graphite -> slate
  "9"     : THEME_COLORS.blue,   // blueberry -> blue
  "10"    : THEME_COLORS.blue,   // basil -> blue
  "11"    : THEME_COLORS.slate,  // tomato -> slate
};

// Simplified palette for events without colorId
const EVENT_PALETTE = [THEME_COLORS.blue, THEME_COLORS.indigo];

function hashColor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return EVENT_PALETTE[Math.abs(h) % EVENT_PALETTE.length];
}

function eventColor(ev) {
  // If it's a Zoom meeting or has a specific description, keep it blue
  if (ev?.description?.includes("zoom.us")) return THEME_COLORS.blue;
  // Otherwise use the mapped GCal colors or the simplified palette
  return GCal_COLORS[ev?.colorId] ?? hashColor(ev?.id ?? "");
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth()    === b.getMonth()
    && a.getDate()     === b.getDate();
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function parseDate(s) { return s ? new Date(s) : null; }

function fmt12(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
function fmtLong(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-IN", {
    weekday:"long", year:"numeric", month:"long", day:"numeric",
    hour:"2-digit", minute:"2-digit", hour12:true,
  });
}
function durationLabel(start, end) {
  if (!start || !end) return "";
  const m = (new Date(end) - new Date(start)) / 60000;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m/60), r = m%60;
  return r ? `${h}h ${r}m` : `${h} hour${h>1?"s":""}`;
}
function minutesFromMidnight(dateStr) {
  const d = new Date(dateStr);
  return d.getHours()*60 + d.getMinutes();
}

// ─── Build 6×7 month grid ────────────────────────────────────────────────────
function buildGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const last  = new Date(year, month+1, 0).getDate();
  const prev  = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = first-1; i >= 0; i--)
    cells.push({ date: new Date(year, month-1, prev-i), cur: false });
  for (let d = 1; d <= last; d++)
    cells.push({ date: new Date(year, month, d), cur: true });
  while (cells.length < 42)
    cells.push({ date: new Date(year, month+1, cells.length-first-last+1), cur: false });
  return cells;
}

// ─── Lay out overlapping events for a column (week view) ─────────────────────
function layoutDayEvents(dayEvents) {
  // sort by start time
  const sorted = [...dayEvents].sort((a,b) => new Date(a.start)-new Date(b.start));
  const cols   = [];   // each col is an array of event objects
  const result = [];   // {ev, col, totalCols}

  sorted.forEach(ev => {
    const evStart = new Date(ev.start).getTime();
    const evEnd   = ev.end ? new Date(ev.end).getTime() : evStart + 30*60000;
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      const lastEnd = new Date(cols[c][cols[c].length-1].end || cols[c][cols[c].length-1].start).getTime() + 30*60000;
      if (evStart >= lastEnd) {
        cols[c].push(ev);
        result.push({ ev, colIdx: c });
        placed = true;
        break;
      }
    }
    if (!placed) {
      cols.push([ev]);
      result.push({ ev, colIdx: cols.length-1 });
    }
  });

  return result.map(r => ({
    ...r,
    totalCols: cols.length,
  }));
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────
function EventModal({ event, onClose }) {
  const ref = useRef();
  const color = eventColor(event);

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);
  useEffect(() => {
    const fn = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const dur  = durationLabel(event.start, event.end);
  const zoomRx = /https:\/\/[^\s<"]+zoom\.us\/j\/[^\s<"]+/;
  const zoomUrl = event.description?.match(zoomRx)?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}>
      <div ref={ref} className="w-full max-w-md rounded-2xl overflow-hidden animate-slide-up"
           style={{ background:"#fff", boxShadow:"0 8px 40px rgba(0,0,0,0.22)" }}>
        {/* Colour bar */}
        <div style={{ height: 6, background: color }} />

        <div className="p-6">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-3 h-3 rounded-sm shrink-0 mt-1" style={{ background: color }} />
              <h2 className="text-[17px] font-semibold text-gray-900 leading-snug">{event.title}</h2>
            </div>
            <button onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 text-sm text-gray-700">
            {/* Date / time */}
            {event.start && (
              <div className="flex items-start gap-3">
                <Clock size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p className="font-medium">{fmtLong(event.start)}</p>
                  {dur && <p className="text-gray-500 text-xs mt-0.5">{dur}</p>}
                </div>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span className="break-words">{event.location}</span>
              </div>
            )}

            {/* Attendees */}
            {event.attendees?.length > 0 && (
              <div className="flex items-start gap-3">
                <Users size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <div className="space-y-1">
                  {event.attendees.slice(0, 6).map(a => (
                    <div key={a.email} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ background:
                          a.responseStatus==="accepted" ? "#34a853" :
                          a.responseStatus==="declined" ? "#ea4335" : "#9aa0a6" }} />
                      <span className="text-gray-600 text-[13px]">
                        {a.displayName !== a.email ? a.displayName : a.email}
                      </span>
                    </div>
                  ))}
                  {event.attendees.length > 6 && (
                    <span className="text-xs text-gray-400">+{event.attendees.length - 6} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="rounded-xl p-3 text-[13px] text-gray-600 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line border border-gray-100"
                   style={{ background: "#f8f9fa" }}>
                {formatDescription(event.description)}
              </div>
            )}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
            {zoomUrl && (
              <a href={zoomUrl} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white transition"
                 style={{ background: "#2D8CFF" }}>
                <Video size={13} /> Join Zoom
              </a>
            )}
            {event.htmlLink && (
              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                <ExternalLink size={13} /> Open in Google Calendar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Day Events Modal ────────────────────────────────────────────────────────
function DayEventsModal({ date, events, onEventClick, onClose }) {
  const ref = useRef();
  const dStr = date?.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}>
      <div ref={ref} className="w-full max-w-sm rounded-2xl overflow-hidden animate-slide-up bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{dStr}</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {events.map(ev => {
            const col = eventColor(ev);
            return (
              <button key={ev.id} onClick={() => { onEventClick(ev); onClose(); }}
                className="w-full text-left flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <div className="w-2.5 h-2.5 rounded-sm mt-1 shrink-0" style={{ background: col }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{ev.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {ev.isAllDay ? "All day" : `${fmt12(ev.start)} – ${fmt12(ev.end)}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({ year, month, events, onEventClick, onMoreClick }) {
  const today = new Date();
  const grid  = buildGrid(year, month);
  const MAX   = 3;

  function dayEvs(date) {
    return events
      .filter(ev => { const s = parseDate(ev.start); return s && sameDay(s, date); })
      .sort((a,b) => new Date(a.start)-new Date(b.start));
  }

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAYS_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border-l border-gray-200"
           style={{ gridAutoRows: "minmax(100px, 1fr)" }}>
        {grid.map((cell, idx) => {
          const evs      = dayEvs(cell.date);
          const visible  = evs.slice(0, MAX);
          const overflow = evs.length - MAX;
          const isToday  = sameDay(cell.date, today);

          return (
            <div key={idx}
                 className="border-r border-b border-gray-200 p-1 flex flex-col gap-0.5 min-h-[100px]"
                 style={{ background: !cell.cur ? "#fafafa" : isToday ? "#e8f0fe" : "#fff" }}>
              {/* Day number */}
              <div className="flex justify-center mb-0.5">
                <span className="w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-medium select-none"
                  style={{
                    background : isToday  ? "#1a73e8" : "transparent",
                    color      : isToday  ? "#fff"    : cell.cur ? "#202124" : "#bdbdbd",
                    fontWeight : isToday  ? 700       : 400,
                  }}>
                  {cell.date.getDate()}
                </span>
              </div>

              {/* Event pills */}
              {visible.map(ev => {
                const col  = eventColor(ev);
                const time = ev.isAllDay ? "" : fmt12(ev.start);
                return (
                  <button key={ev.id} onClick={() => onEventClick(ev)}
                    className="w-full text-left rounded-md px-2 py-1 truncate text-[11px] font-semibold text-white transition-all hover:brightness-110 shadow-sm"
                    style={{ background: col }}>
                    {time && <span className="opacity-90 mr-1.5 font-bold">{time}</span>}
                    {ev.title}
                  </button>
                );
              })}
              {overflow > 0 && (
                <button onClick={() => onMoreClick(cell.date, evs)}
                  className="text-[11px] font-medium text-gray-500 hover:text-blue-600 text-left pl-1">
                  +{overflow} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ viewDate, events, onEventClick }) {
  const today      = new Date();
  const nowMinutes = today.getHours()*60 + today.getMinutes();
  const scrollRef  = useRef();

  // Build week days (Sun→Sat)
  const monday = new Date(viewDate);
  monday.setDate(viewDate.getDate() - viewDate.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate()+i); return d;
  });

  // Scroll to ~8 AM on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_PX;
  }, []);

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const totalH = hours.length * HOUR_PX;

  // All-day events
  const allDayEvs = events.filter(ev => ev.isAllDay);

  // Timed events per day with layout
  function timedForDay(day) {
    return events.filter(ev => {
      if (ev.isAllDay) return false;
      const s = parseDate(ev.start);
      return s && sameDay(s, day);
    });
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ maxHeight: 580 }}>
      {/* Sticky header */}
      <div className="flex shrink-0 border-b border-gray-200 bg-white sticky top-0 z-10">
        {/* TZ label */}
        <div className="w-14 shrink-0 text-[10px] text-gray-400 flex items-end justify-end pr-1 pb-1">
          IST
        </div>
        {weekDays.map((day, i) => {
          const isT = sameDay(day, today);
          return (
            <div key={i} className="flex-1 text-center py-2 border-l border-gray-200 first:border-l-0">
              <div className="text-[11px] font-semibold uppercase text-gray-500">
                {DAYS_SHORT[day.getDay()]}
              </div>
              <div className="mt-0.5">
                <span className="w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: isT ? "#1a73e8" : "transparent", color: isT ? "#fff" : "#202124" }}>
                  {day.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day strip */}
      {allDayEvs.length > 0 && (
        <div className="flex shrink-0 border-b border-gray-200 bg-white">
          <div className="w-14 shrink-0 text-[10px] text-gray-400 flex items-center justify-end pr-1">
            all‑day
          </div>
          {weekDays.map((day, di) => {
            const dayAllDay = allDayEvs.filter(ev => {
              const s = parseDate(ev.start); return s && sameDay(s, day);
            });
            return (
              <div key={di} className="flex-1 border-l border-gray-200 first:border-l-0 p-0.5 min-h-[28px]">
                {dayAllDay.map(ev => (
                  <button key={ev.id} onClick={() => onEventClick(ev)}
                    className="w-full text-left rounded-sm px-1 py-0.5 text-[11px] font-medium text-white truncate mb-0.5"
                    style={{ background: eventColor(ev) }}>
                    {ev.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="overflow-y-auto flex" style={{ flex:1 }}>
        {/* Time labels */}
        <div className="w-14 shrink-0 relative" style={{ height: totalH }}>
          {hours.map(h => (
            <div key={h} className="absolute left-0 right-0 flex justify-end pr-2"
                 style={{ top: (h - START_HOUR)*HOUR_PX - 8, height: HOUR_PX }}>
              {h > 0 && (
                <span className="text-[10px] text-gray-400 leading-none">
                  {h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h-12} PM`}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1 relative">
          {weekDays.map((day, di) => {
            const isT     = sameDay(day, today);
            const timedEvs = timedForDay(day);
            const laid    = layoutDayEvents(timedEvs);

            return (
              <div key={di} className="flex-1 relative border-l border-gray-200 first:border-l-0"
                   style={{ height: totalH, background: isT ? "rgba(26,115,232,0.03)" : "transparent" }}>
                {/* Hour lines */}
                {hours.map(h => (
                  <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                       style={{ top: (h - START_HOUR)*HOUR_PX }} />
                ))}
                {/* Half-hour dashes */}
                {hours.map(h => (
                  <div key={`half-${h}`} className="absolute left-0 right-0 border-t border-dashed border-gray-100"
                       style={{ top: (h - START_HOUR)*HOUR_PX + HOUR_PX/2 }} />
                ))}

                {/* Current time line */}
                {isT && (
                  <div className="absolute left-0 right-0 z-20 flex items-center"
                       style={{ top: (nowMinutes - START_HOUR*60)/60 * HOUR_PX }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                    <div className="flex-1 h-[2px] bg-red-500" />
                  </div>
                )}

                {/* Events */}
                {laid.map(({ ev, colIdx, totalCols }) => {
                  const startMin = minutesFromMidnight(ev.start) - START_HOUR*60;
                  const endMin   = ev.end
                    ? minutesFromMidnight(ev.end) - START_HOUR*60
                    : startMin + 30;
                  const top    = (startMin/60)*HOUR_PX;
                  const height = Math.max(((endMin-startMin)/60)*HOUR_PX, 18);
                  const width  = `${100/totalCols}%`;
                  const left   = `${(colIdx/totalCols)*100}%`;
                  const col    = eventColor(ev);
                  const short  = height < 32;

                  return (
                    <button key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className="absolute rounded-md overflow-hidden text-left transition-opacity hover:opacity-90 z-10"
                      style={{ top, height, left, width, background: col, padding: short?"1px 4px":"3px 6px" }}>
                      <p className="text-white font-semibold leading-tight truncate"
                         style={{ fontSize: short ? 10 : 11 }}>
                        {ev.title}
                      </p>
                      {!short && (
                        <p className="text-white/80 leading-tight truncate" style={{ fontSize: 10 }}>
                          {fmt12(ev.start)} – {fmt12(ev.end)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Agenda View ──────────────────────────────────────────────────────────────
function AgendaView({ events, onEventClick }) {
  const today = startOfDay(new Date());
  const upcoming = events
    .filter(ev => { const s = parseDate(ev.start); return s && s >= today; })
    .sort((a,b) => new Date(a.start)-new Date(b.start))
    .slice(0, 50);

  if (!upcoming.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Calendar size={40} className="mb-3 opacity-30" />
      <p className="text-sm">No upcoming events</p>
    </div>
  );

  let lastDateStr = null;
  return (
    <div className="overflow-y-auto" style={{ maxHeight: 540 }}>
      {upcoming.map(ev => {
        const s = parseDate(ev.start);
        const dStr = s?.toLocaleDateString("en-IN", { weekday:"short", month:"short", day:"numeric", year:"numeric" });
        const showDate = dStr !== lastDateStr;
        lastDateStr = dStr;
        const col = eventColor(ev);
        const isToday = s && sameDay(s, new Date());

        return (
          <React.Fragment key={ev.id}>
            {showDate && (
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100"
                   style={{ background: "#f8f9fa" }}>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{dStr}</span>
                {isToday && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: "#1a73e8" }}>Today</span>
                )}
              </div>
            )}
            <button onClick={() => onEventClick(ev)}
              className="w-full text-left flex items-start gap-4 px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
              <div className="w-2.5 h-2.5 rounded-sm mt-1.5 shrink-0" style={{ background: col }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800 truncate group-hover:text-blue-700">
                  {ev.title}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {ev.isAllDay ? "All day" : `${fmt12(ev.start)} – ${fmt12(ev.end)}`}
                  {ev.attendees?.length > 0 && ` · ${ev.attendees.length} guest${ev.attendees.length>1?"s":""}`}
                </p>
              </div>
              {ev.description?.includes("zoom.us") && (
                <Video size={13} className="mt-1 shrink-0" style={{ color:"#2D8CFF" }} />
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardCalendar() {
  const today = new Date();
  const [view,      setView]      = useState("month");
  const [viewDate,  setViewDate]  = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [dayEvents, setDayEvents] = useState(null); // { date, events }

  const fetchEvents = useCallback(async (date) => {
    setLoading(true); setError(null);
    try {
      const tMin = new Date(date.getFullYear(), date.getMonth()-1, 1).toISOString();
      const tMax = new Date(date.getFullYear(), date.getMonth()+3, 0).toISOString();
      const res  = await fetch(`/api/calendar-events?timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      setEvents(data.events || []);
    } catch {
      setError("Could not load events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(viewDate); }, [viewDate, fetchEvents]);

  // Navigation
  function prev() {
    if (view === "week") {
      const d = new Date(viewDate); d.setDate(d.getDate()-7);
      setViewDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    } else {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()-1, 1));
    }
  }
  function next() {
    if (view === "week") {
      const d = new Date(viewDate); d.setDate(d.getDate()+7);
      setViewDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    } else {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1));
    }
  }
  function goToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  }

  // Header label
  let headerLabel;
  if (view === "week") {
    const dow  = viewDate.getDay();
    const sun  = new Date(viewDate); sun.setDate(viewDate.getDate()-dow);
    const sat  = new Date(sun);      sat.setDate(sun.getDate()+6);
    headerLabel = sun.getMonth() === sat.getMonth()
      ? `${MONTHS_LONG[sun.getMonth()]} ${sun.getDate()}–${sat.getDate()}, ${sat.getFullYear()}`
      : `${MONTHS_LONG[sun.getMonth()]} ${sun.getDate()} – ${MONTHS_LONG[sat.getMonth()]} ${sat.getDate()}, ${sat.getFullYear()}`;
  } else {
    headerLabel = `${MONTHS_LONG[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  }

  return (
    <>
      <div className="panel-surface overflow-hidden" style={{ background: "#fff" }}>
        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
          {/* Left: icon + title */}
          <div className="flex items-center gap-2">
            <Calendar size={18} style={{ color:"#2B3990" }} />
            <span className="text-[15px] font-bold text-slate-800">Google Calendar</span>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* View tabs */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[12px] font-semibold shadow-sm">
              {["month","week","agenda"].map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="px-4 py-1.5 transition-all capitalize"
                  style={{
                    background : view===v ? "#2B3990" : "#fff",
                    color      : view===v ? "#fff"    : "#475569",
                  }}>
                  {v}
                </button>
              ))}
            </div>

            {/* Today */}
            <button onClick={goToday}
              className="px-4 py-1.5 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
              Today
            </button>

            {/* Arrows + month label */}
            <div className="flex items-center gap-1">
              <button onClick={prev}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-[13px] font-bold text-slate-700 min-w-[175px] text-center select-none uppercase tracking-wide">
                {headerLabel}
              </span>
              <button onClick={next}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Refresh */}
            <button onClick={() => fetchEvents(viewDate)} disabled={loading} title="Refresh"
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors disabled:opacity-40">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 px-4 py-2 rounded-lg text-xs text-amber-800 border border-amber-200"
               style={{ background:"#fffbeb" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <RefreshCw size={26} className="animate-spin mb-3 opacity-40" />
            <p className="text-sm">Loading calendar…</p>
          </div>
        ) : view === "month" ? (
          <MonthView
            year={viewDate.getFullYear()}
            month={viewDate.getMonth()}
            events={events}
            onEventClick={setSelected}
            onMoreClick={(date, evs) => setDayEvents({ date, events: evs })}
          />
        ) : view === "week" ? (
          <WeekView
            viewDate={viewDate}
            events={events}
            onEventClick={setSelected}
          />
        ) : (
          <AgendaView events={events} onEventClick={setSelected} />
        )}
      </div>

      {selected && (
        <EventModal event={selected} onClose={() => setSelected(null)} />
      )}

      {dayEvents && (
        <DayEventsModal
          date={dayEvents.date}
          events={dayEvents.events}
          onEventClick={setSelected}
          onClose={() => setDayEvents(null)}
        />
      )}
    </>
  );
}
