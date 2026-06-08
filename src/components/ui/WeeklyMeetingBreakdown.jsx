"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

const MEETING_TYPES = [
  "Weekly review meeting",
  "Monthly review meeting",
  "Committee meeting",
  "Urgent dept meeting",
  "Cross dept meeting",
  "External meeting",
];

const TYPE_COLORS = {
  "Weekly review meeting":   { bg: "bg-blue-50",   text: "text-blue-700",   bar: "bg-blue-500",   dot: "bg-blue-500"   },
  "Monthly review meeting":  { bg: "bg-violet-50", text: "text-violet-700", bar: "bg-violet-500", dot: "bg-violet-500" },
  "Committee meeting":       { bg: "bg-amber-50",  text: "text-amber-700",  bar: "bg-amber-500",  dot: "bg-amber-500"  },
  "Urgent dept meeting":     { bg: "bg-red-50",    text: "text-red-700",    bar: "bg-red-500",    dot: "bg-red-500"    },
  "Cross dept meeting":      { bg: "bg-emerald-50",text: "text-emerald-700",bar: "bg-emerald-500",dot: "bg-emerald-500"},
  "External meeting":        { bg: "bg-slate-100", text: "text-slate-700",  bar: "bg-slate-500",  dot: "bg-slate-500"  },
  "Other":                   { bg: "bg-slate-50",  text: "text-slate-500",  bar: "bg-slate-300",  dot: "bg-slate-400"  },
};

// Returns the Monday of the week containing `date`
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function formatWeekLabel(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

function isSameWeek(date, weekStart) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return d >= weekStart && d < end;
}

export default function WeeklyMeetingBreakdown({ meetings }) {
  const todayWeekStart = useMemo(() => getWeekStart(new Date()), []);
  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekStart = useMemo(
    () => addWeeks(todayWeekStart, weekOffset),
    [todayWeekStart, weekOffset]
  );

  // Quick-jump presets
  const presets = [
    { label: "Last week", offset: -1 },
    { label: "This week", offset: 0 },
    { label: "Next week", offset: 1 },
    { label: "Week +2",   offset: 2 },
  ];

  // Filter meetings for the selected week
  const weekMeetings = useMemo(
    () => meetings.filter((m) => isSameWeek(m.scheduleDateTime, currentWeekStart)),
    [meetings, currentWeekStart]
  );

  // Count by type
  const breakdown = useMemo(() => {
    const counts = {};
    for (const m of weekMeetings) {
      const key = m.meetingType && MEETING_TYPES.includes(m.meetingType) ? m.meetingType : "Other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [weekMeetings]);

  const maxCount = Math.max(...Object.values(breakdown), 1);

  // All known types + "Other" if present
  const displayTypes = [
    ...MEETING_TYPES.filter((t) => breakdown[t] > 0),
    ...(breakdown["Other"] > 0 ? ["Other"] : []),
  ];

  return (
    <div className="panel-surface-white p-5">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Meeting types by week</h2>
          <p className="text-sm text-slate-500">
            {weekMeetings.length} meeting{weekMeetings.length !== 1 ? "s" : ""} in the selected week.
          </p>
        </div>
        <Link href="/meetings" className="text-sm font-semibold text-[#2B3990] hover:underline self-start sm:self-auto">
          Open module →
        </Link>
      </div>

      {/* Week navigation */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* Prev / Next arrows */}
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 transition"
          aria-label="Previous week"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Quick presets */}
        {presets.map((p) => (
          <button
            key={p.offset}
            onClick={() => setWeekOffset(p.offset)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              weekOffset === p.offset
                ? "bg-[#2B3990] text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}

        <button
          onClick={() => setWeekOffset((o) => o + 1)}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 transition"
          aria-label="Next week"
        >
          <ChevronRight size={16} />
        </button>

        {/* Current week label */}
        <span className="ml-auto text-sm font-semibold text-slate-600">
          {formatWeekLabel(currentWeekStart)}
        </span>
      </div>

      {/* Breakdown */}
      {weekMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <LayoutGrid size={28} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No meetings scheduled for this week.</p>
        </div>
      ) : displayTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <LayoutGrid size={28} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No meetings with a type set this week.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayTypes.map((type) => {
            const count = breakdown[type] || 0;
            const colors = TYPE_COLORS[type] || TYPE_COLORS["Other"];
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={type} className="flex items-center gap-3">
                {/* Label */}
                <span className={`w-44 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${colors.text}`}>
                  {type}
                </span>
                {/* Bar */}
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {/* Count */}
                <span className="w-8 text-right text-sm font-bold text-slate-700">{count}</span>
              </div>
            );
          })}

          {/* Untyped count note */}
          {breakdown["Other"] > 0 && (
            <p className="pt-1 text-xs text-slate-400 italic">
              * "Other" includes meetings with no type selected.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
