"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CalendarClock,
  Users,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import DashboardCalendar from "@/components/ui/DashboardCalendar";
import RefreshButton from "@/components/ui/RefreshButton";
import WeeklyMeetingBreakdown from "@/components/ui/WeeklyMeetingBreakdown";
import TruckLoader from "@/components/TruckLoader";

const statCards = [
  {
    label: "Active Employees",
    valueKey: "activeEmployees",
    icon: Users,
    color: "#2563eb",
    description: "People available for internal scheduling and attendee selection.",
  },
  {
    label: "Departments",
    valueKey: "departments",
    icon: Building2,
    color: "#7c3aed",
    description: "Business units configured for auto-attendee selection workflows.",
  },
  {
    label: "Today's Upcoming",
    valueKey: "upcomingMeetings",
    icon: CalendarClock,
    color: "#ea580c",
    description: "Scheduled sessions waiting for reminders and virtual room creation today.",
  },
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [calendarReady, setCalendarReady] = useState(false);

  const isLoading = !dataReady || !calendarReady;

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        setMetrics(payload.data.metrics);
        setMeetings(payload.data.meetings);
        setDataReady(true);
      })
      .catch(() => setDataReady(true)); // unblock on error
  }, []);

  const handleCalendarReady = useCallback(() => {
    setCalendarReady(true);
  }, []);

  return (
    <>
      {isLoading && <TruckLoader />}
      <div className={isLoading ? "invisible" : "space-y-6"}>
        <section className="panel-surfac -ml-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2B3990]">
                Delivery Snapshot
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                IAC Meeting Central Dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Welcome to your central hub for overseeing and optimizing your organization's meeting operations.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <RefreshButton />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={metrics?.[card.valueKey] ?? 0}
              icon={card.icon}
              color={card.color}
              description={card.description}
            />
          ))}
        </section>

        {/* ── Google Calendar ── */}
        <section>
          <DashboardCalendar onReady={handleCalendarReady} />
        </section>

        <section className="grid gap-6">
          <WeeklyMeetingBreakdown meetings={meetings} />
        </section>
      </div>
    </>
  );
}
