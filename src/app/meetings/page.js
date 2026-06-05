"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarDays, Clock3, Pencil, Plus, Trash2, UsersRound, Video } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import DeleteConfirmationModal from "@/components/ui/DeleteConfirmationModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors = {
  upcoming: "#2563eb",
  ongoing: "#16a34a",
  completed: "#7c3aed",
  cancelled: "#dc2626",
};

const emptyForm = {
  title: "",
  agenda: "",
  scheduleDateTime: "",
  duration: 30,
  hostId: "",
  departmentIds: [],
  internalAttendeeIds: [],
  externalAttendeesText: "",
  status: "upcoming",
};

async function readResponse(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload.data;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function parseExternalAttendees(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", email = "", status = "invited"] = line.split(",").map((part) => part.trim());
      return { name, email, status: status || "invited" };
    })
    .filter((attendee) => attendee.name && attendee.email);
}

function serializeExternalAttendees(attendees = []) {
  return attendees
    .map((attendee) => [attendee.name, attendee.email, attendee.status || "invited"].join(", "))
    .join("\n");
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, meeting: null, isDeleting: false });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [meetingResponse, employeeResponse, departmentResponse] = await Promise.all([
        fetch("/api/meetings", { cache: "no-store" }),
        fetch("/api/employees", { cache: "no-store" }),
        fetch("/api/departments", { cache: "no-store" }),
      ]);

      const [meetingData, employeeData, departmentData] = await Promise.all([
        readResponse(meetingResponse),
        readResponse(employeeResponse),
        readResponse(departmentResponse),
      ]);

      setMeetings(meetingData);
      setEmployees(employeeData);
      setDepartments(departmentData);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      await loadData();
    }

    bootstrap();
  }, []);

  const employeeMap = useMemo(
    () =>
      Object.fromEntries(
        employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`])
      ),
    [employees]
  );

  const departmentMap = useMemo(
    () => Object.fromEntries(departments.map((department) => [department.id, department.name])),
    [departments]
  );

  const filteredMeetings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return meetings;
    }

    return meetings.filter((meeting) =>
      [
        meeting.title,
        meeting.agenda,
        meeting.zoomMeetingId,
        employeeMap[meeting.hostId],
        ...meeting.departmentIds.map((departmentId) => departmentMap[departmentId]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [meetings, query, employeeMap, departmentMap]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFeedback({ type: "", message: "" });
  };

  const startEdit = (meeting) => {
    setEditingId(meeting.id);
    setForm({
      title: meeting.title,
      agenda: meeting.agenda,
      scheduleDateTime: meeting.scheduleDateTime.slice(0, 16),
      duration: meeting.duration,
      hostId: meeting.hostId,
      departmentIds: meeting.departmentIds,
      internalAttendeeIds: meeting.internalAttendeeIds,
      externalAttendeesText: serializeExternalAttendees(meeting.externalAttendees),
      status: meeting.status,
    });
    setFeedback({ type: "", message: "" });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback({ type: "", message: "" });

    try {
      const payload = {
        ...form,
        duration: Number(form.duration),
        externalAttendees: parseExternalAttendees(form.externalAttendeesText),
      };

      const response = await fetch(editingId ? `/api/meetings/${editingId}` : "/api/meetings", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      await readResponse(response);
      await loadData();
      resetForm();
      setFeedback({
        type: "success",
        message: editingId ? "Meeting updated successfully." : "Meeting created successfully.",
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeMeeting = (meeting) => {
    setDeleteModal({ isOpen: true, meeting, isDeleting: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.meeting) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      const response = await fetch(`/api/meetings/${deleteModal.meeting.id}`, { method: "DELETE" });
      await readResponse(response);
      await loadData();
      if (editingId === deleteModal.meeting.id) {
        resetForm();
      }
      setFeedback({ type: "success", message: "Meeting deleted successfully." });
      setDeleteModal({ isOpen: false, meeting: null, isDeleting: false });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const toggleArrayValue = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
  };

  const handleDepartmentToggle = (departmentId) => {
    const isSelecting = !form.departmentIds.includes(departmentId);

    setForm((current) => {
      const nextDepartmentIds = isSelecting
        ? [...current.departmentIds, departmentId]
        : current.departmentIds.filter((id) => id !== departmentId);

      let nextInternalAttendeeIds = [...current.internalAttendeeIds];

      if (isSelecting) {
        // Automatically add all active employees from this department
        const departmentEmployees = employees
          .filter((emp) => emp.status === "active" && emp.departmentId === departmentId)
          .map((emp) => emp.id);

        nextInternalAttendeeIds = Array.from(new Set([...nextInternalAttendeeIds, ...departmentEmployees]));
      } else {
        // Automatically remove all employees from this department
        const departmentEmployees = employees
          .filter((emp) => emp.departmentId === departmentId)
          .map((emp) => emp.id);

        nextInternalAttendeeIds = nextInternalAttendeeIds.filter(
          (id) => !departmentEmployees.includes(id)
        );
      }

      return {
        ...current,
        departmentIds: nextDepartmentIds,
        internalAttendeeIds: nextInternalAttendeeIds,
      };
    });
  };

  return (
    <div className="space-y-6">
      <section className="panel-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2B3990]">
              Modules 3 & 4
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Meeting Scheduler & Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Create, update, track, and review meetings with internal and external attendees.
            </p>
          </div>

          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77]"
          >
            <Plus size={16} />
            New meeting
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Video} label="Total meetings" value={meetings.length} accent="#2B3990" />
        <MetricCard
          icon={CalendarDays}
          label="Upcoming meetings"
          value={meetings.filter((meeting) => meeting.status === "upcoming").length}
          accent="#ea580c"
        />
        <MetricCard
          icon={Clock3}
          label="Live meetings"
          value={meetings.filter((meeting) => meeting.status === "ongoing").length}
          accent="#16a34a"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <form onSubmit={submitForm} className="panel-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Edit meeting" : "Create meeting"}
              </h2>
              <p className="text-sm text-slate-500">Meetings are automatically synchronized with Zoom API.</p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel edit
              </button>
            )}
          </div>

          {feedback.message && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                feedback.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <Field label="Meeting title">
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="input-base"
            />
          </Field>
          <Field label="Agenda">
            <textarea
              rows={4}
              value={form.agenda}
              onChange={(event) => setForm((current) => ({ ...current, agenda: event.target.value }))}
              placeholder="Provide a brief description or agenda for the meeting."
              className="input-base"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Schedule">
              <input
                required
                type="datetime-local"
                value={form.scheduleDateTime}
                onChange={(event) => setForm((current) => ({ ...current, scheduleDateTime: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                required
                min="15"
                type="number"
                value={form.duration}
                onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))}
                className="input-base"
              />
            </Field>
          </div>
          <Field label="Host">
            <select
              required
              value={form.hostId}
              onChange={(event) => setForm((current) => ({ ...current, hostId: event.target.value }))}
              className="input-base"
            >
              <option value="">Select a host</option>
              {employees
                .filter((employee) => employee.status === "active")
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              className="input-base"
            >
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>

          <ChecklistGroup
            title="Departments"
            items={departments.map((department) => ({ id: department.id, label: department.name }))}
            selectedItems={form.departmentIds}
            onToggle={handleDepartmentToggle}
          />

          <ChecklistGroup
            title="Internal attendees"
            items={employees
              .filter((employee) => employee.status === "active")
              .map((employee) => ({
                id: employee.id,
                label: `${employee.firstName} ${employee.lastName} · ${employee.designation || employee.role}`,
              }))}
            selectedItems={form.internalAttendeeIds}
            onToggle={(value) => toggleArrayValue("internalAttendeeIds", value)}
          />

          <Field label="External attendees">
            <textarea
              rows={4}
              value={form.externalAttendeesText}
              onChange={(event) => setForm((current) => ({ ...current, externalAttendeesText: event.target.value }))}
              placeholder="One attendee per line: Name, email@example.com, invited"
              className="input-base"
            />
          </Field>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : editingId ? "Update meeting" : "Create meeting"}
          </button>
        </form>

        <section className="panel-surface p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Meeting registry</h2>
              <p className="text-sm text-slate-500">Review meetings, open details, edit scheduling, or remove entries.</p>
            </div>
            <input
              placeholder="Search by title, host, department, or Zoom ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input-base min-w-[260px]"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meeting</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Attendees</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    Loading meetings...
                  </TableCell>
                </TableRow>
              ) : filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => (
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
                        <p className="mt-1 text-xs text-slate-500">{meeting.agenda || "No agenda"}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {meeting.departmentIds.length > 0 ? (
                            meeting.departmentIds.map((departmentId) => (
                              <span
                                key={departmentId}
                                className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                              >
                                {departmentMap[departmentId] ?? "Unknown"}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No departments</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {meeting.hostId === "external" ? (
                        <span className="flex items-center gap-1.5 text-slate-500 italic">
                          <Calendar size={14} /> Google Calendar
                        </span>
                      ) : (
                        employeeMap[meeting.hostId] ?? "Unknown"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                        <UsersRound size={14} className="text-slate-400" />
                        <span>{meeting.internalAttendeeIds?.length + meeting.externalAttendees?.length || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(meeting.scheduleDateTime)}</TableCell>
                    <TableCell>
                      <StatusBadge status={meeting.status} color={statusColors[meeting.status] ?? "#64748b"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!meeting.isVirtual && (
                          <>
                            <ActionButton icon={Pencil} label="Edit" onClick={() => startEdit(meeting)} />
                            <ActionButton
                              icon={Trash2}
                              label="Delete"
                              danger
                              onClick={() => removeMeeting(meeting)}
                            />
                          </>
                        )}
                        {meeting.isVirtual && (
                          <span className="text-xs text-slate-400 italic">External Event</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No meetings match the current search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </section>

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, meeting: null, isDeleting: false })}
        onConfirm={handleConfirmDelete}
        isLoading={deleteModal.isDeleting}
        title="Delete Meeting"
        message={`Are you sure you want to delete "${deleteModal.meeting?.title}"? This will also cancel the meeting on Zoom and cannot be undone.`}
      />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="panel-surface p-5">
      <div className="flex items-center gap-3">
        <Icon className="shrink-0" style={{ color: accent }} size={20} />
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">Live count from the current meeting registry.</p>
        </div>
      </div>
      <p className="mt-4 text-3xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ChecklistGroup({ title, items, selectedItems, onToggle }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{title}</p>
      <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selectedItems.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2B3990] focus:ring-[#2B3990]/20"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        danger
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
