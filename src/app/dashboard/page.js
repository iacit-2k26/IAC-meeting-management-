import Link from "next/link";
import {
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  PlayCircle,
  Users,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardCalendar from "@/components/ui/DashboardCalendar";
import RefreshButton from "@/components/ui/RefreshButton";
import { getDashboardData } from "@/lib/repository";
import { formatDescription } from "@/lib/formatters";

const statusColors = {
  upcoming: "#2563eb",
  ongoing: "#16a34a",
  completed: "#7c3aed",
};

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
  {
    label: "Today's Ongoing",
    valueKey: "ongoingMeetings",
    icon: PlayCircle,
    color: "#16a34a",
    description: "Live sessions currently in progress across selected departments today.",
  },
  {
    label: "Today's Completed",
    valueKey: "completedMeetings",
    icon: CheckCircle2,
    color: "#0f766e",
    description: "Closed sessions ready for attendance review and audit reporting today.",
  },
];

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const { metrics, meetings, departments, employees } = await getDashboardData();
  const departmentMap = Object.fromEntries(departments.map((department) => [department.id, department.name]));
  const employeeMap = Object.fromEntries(
    employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`])
  );

  return (
    <div className="space-y-6">
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
            {/* <div className="flex flex-wrap gap-3">
              <Link
                href="/meetings"
                className="rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77]"
              >
                Review meetings
              </Link>
              <Link
                href="/employees"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Manage team
              </Link>
            </div> */}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={metrics[card.valueKey]}
            icon={card.icon}
            color={card.color}
            description={card.description}
          />
        ))}
      </section>

      {/* ── Google Calendar ── */}
      <section>
        <DashboardCalendar />
      </section>

      <section className="grid gap-6">
        <div className="panel-surface-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Meeting activity</h2>
              <p className="text-sm text-slate-500">Recent meetings across all departments.</p>
            </div>
            <Link href="/meetings" className="text-sm font-semibold text-[#2B3990] hover:underline">
              Open module
            </Link>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meeting</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetings.map((meeting) => (
                <TableRow key={meeting.id}>
                  <TableCell>
                    <div>
                      {meeting.isVirtual ? (
                        <span className="font-semibold text-slate-800">
                          {meeting.title}
                        </span>
                      ) : (
                        <Link
                          href={`/meetings/${meeting.id}`}
                          className="font-semibold text-slate-800 hover:text-[#2B3990]"
                        >
                          {meeting.title}
                        </Link>
                      )}
                      <p className="mt-1 max-w-md truncate text-xs text-slate-500">
                        {formatDescription(meeting.agenda) || "No agenda"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {meeting.hostId === "external" ? (
                      <span className="flex items-center gap-1.5 text-slate-500 italic">
                        <Calendar size={14} /> Google Calendar
                      </span>
                    ) : (
                      employeeMap[meeting.hostId] ?? "Unknown user"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {meeting.departmentIds.length > 0 ? (
                        meeting.departmentIds.map((departmentId) => (
                          <span
                            key={departmentId}
                            className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                          >
                            {departmentMap[departmentId] ?? "Unknown department"}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No departments</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(meeting.scheduleDateTime)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={meeting.status}
                      color={statusColors[meeting.status] ?? "#64748b"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

     
    </div>
  );
}
