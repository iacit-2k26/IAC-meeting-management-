import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, UsersRound, Video } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { getDashboardData, getMeeting } from "@/lib/repository";
import { formatDescription } from "@/lib/formatters";

const statusColors = {
  upcoming: "#2563eb",
  ongoing: "#16a34a",
  completed: "#7c3aed",
  cancelled: "#dc2626",
};

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function MeetingDetailsPage({ params }) {
  const resolvedParams = await params;
  const [meeting, dashboardData] = await Promise.all([
    getMeeting(resolvedParams.id),
    getDashboardData(),
  ]);

  if (!meeting) {
    notFound();
  }

  const departmentMap = Object.fromEntries(
    dashboardData.departments.map((department) => [department.id, department.name])
  );
  const employeeMap = Object.fromEntries(
    dashboardData.employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`])
  );

  return (
    <div className="space-y-6">
      <section className="panel-surface p-5 sm:p-6">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2B3990] hover:underline"
        >
          <ArrowLeft size={16} />
          Back to meetings
        </Link>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2B3990]">
              Meeting details
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              {meeting.title}
            </h1>
            <div className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate-600">
              {formatDescription(meeting.agenda) || "No agenda provided for this meeting."}
            </div>
          </div>

          <StatusBadge
            status={meeting.status}
            color={statusColors[meeting.status] ?? "#64748b"}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel-surface p-5">
          <div className="flex items-center gap-3">
            <Video className="text-[#2B3990]" size={20} />
            <div>
              <p className="text-sm font-semibold text-slate-800">Zoom meeting</p>
              <p className="text-xs text-slate-500">Live API integration active.</p>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-2xl font-extrabold text-slate-900">{meeting.zoomMeetingId}</p>
            {meeting.zoomJoinUrl && (
              <a
                href={meeting.zoomJoinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold text-[#2B3990] hover:underline"
              >
                Join meeting →
              </a>
            )}
            {meeting.zoomPassword && (
              <p className="text-[10px] text-slate-400">Passcode: {meeting.zoomPassword}</p>
            )}
          </div>
        </div>

        <div className="panel-surface p-5">
          <div className="flex items-center gap-3">
            <Clock3 className="text-[#16a34a]" size={20} />
            <div>
              <p className="text-sm font-semibold text-slate-800">Duration</p>
              <p className="text-xs text-slate-500">Current scheduled session length.</p>
            </div>
          </div>
          <p className="mt-4 text-2xl font-extrabold text-slate-900">{meeting.duration} minutes</p>
        </div>

        <div className="panel-surface p-5">
          <div className="flex items-center gap-3">
            <UsersRound className="text-[#7c3aed]" size={20} />
            <div>
              <p className="text-sm font-semibold text-slate-800">Attendees</p>
              <p className="text-xs text-slate-500">Internal plus external participants.</p>
            </div>
          </div>
          <p className="mt-4 text-2xl font-extrabold text-slate-900">
            {meeting.internalAttendeeIds.length + meeting.externalAttendees.length}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel-surface p-5">
          <h2 className="text-lg font-bold text-slate-900">Session summary</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Host</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-900">{employeeMap[meeting.hostId] ?? "Unknown user"}</dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Schedule</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(meeting.scheduleDateTime)}</dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Departments</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {meeting.departmentIds.map((departmentId) => (
                  <span
                    key={departmentId}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
                  >
                    {departmentMap[departmentId] ?? "Unknown department"}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>

        <div className="panel-surface p-5">
          <h2 className="text-lg font-bold text-slate-900">Participants</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Internal attendees
              </p>
              <div className="mt-2 space-y-2">
                {meeting.internalAttendeeIds.map((attendeeId) => (
                  <div
                    key={attendeeId}
                    className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    {employeeMap[attendeeId] ?? "Unknown user"}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                External attendees
              </p>
              <div className="mt-2 space-y-2">
                {meeting.externalAttendees.length > 0 ? (
                  meeting.externalAttendees.map((attendee) => (
                    <div
                      key={attendee.email}
                      className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-slate-800">{attendee.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{attendee.email}</p>
                      <div className="mt-2">
                        <StatusBadge status={attendee.status} color="#ea580c" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
                    No external attendees added yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
