"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarDays, CheckCircle2, Clock, Clock3, ExternalLink, HelpCircle, Mail, Pencil, Plus, RefreshCw, Trash2, User, UsersRound, Video, X, XCircle } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import DeleteConfirmationModal from "@/components/ui/DeleteConfirmationModal";
import { formatDescription, stripNewlines } from "@/lib/formatters";
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
      const parts = line.split(",").map((part) => part.trim());
      
      // If only an email is provided (no commas)
      if (parts.length === 1 && parts[0].includes("@")) {
        const email = parts[0];
        // Use the part before @ as a temporary name
        const name = email.split("@")[0].replace(/[._-]/g, " ");
        return { name, email, status: "invited" };
      }

      const [name = "", email = "", status = "invited"] = parts;
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
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0],
    end: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split("T")[0],
  });
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, meeting: null, isDeleting: false });
  // Attendees modal state
  const [attendeesModal, setAttendeesModal] = useState({ isOpen: false, meeting: null });

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
    
    return meetings.filter((meeting) => {
      // 1. Date Range Filter
      const meetingDate = new Date(meeting.scheduleDateTime).toISOString().split("T")[0];
      const isWithinDateRange = meetingDate >= dateRange.start && meetingDate <= dateRange.end;
      
      if (!isWithinDateRange) return false;

      // 2. Search Query Filter
      if (!normalizedQuery) return true;

      return [
        meeting.title,
        meeting.agenda,
        meeting.zoomMeetingId,
        employeeMap[meeting.hostId],
        ...meeting.departmentIds.map((departmentId) => departmentMap[departmentId]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [meetings, query, dateRange, employeeMap, departmentMap]);

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
      <section className="-ml-5 p-5 sm:p-6">
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77]"
            >
              <Plus size={16} />
              New meeting
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Video} label="Total meetings" value={filteredMeetings.length} accent="#2B3990" />
        <MetricCard
          icon={CalendarDays}
          label="Upcoming meetings"
          value={filteredMeetings.filter((meeting) => meeting.status === "upcoming").length}
          accent="#ea580c"
        />
        <MetricCard
          icon={Clock3}
          label="Live meetings"
          value={filteredMeetings.filter((meeting) => meeting.status === "ongoing").length}
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
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Meeting registry</h2>
                <p className="text-sm text-slate-500">Review meetings, open details, edit scheduling, or remove entries.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5">
                  <Calendar size={16} className="text-slate-400" />
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
                  />
                </div>
                <input
                  placeholder="Search by title, host, department, or Zoom ID"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input-base min-w-[260px]"
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Meeting</TableHead>
                <TableHead className="w-[15%]">Host</TableHead>
                <TableHead className="w-[10%]">Attendees</TableHead>
                <TableHead className="w-[15%]">Schedule</TableHead>
                <TableHead className="w-[12%]">Status</TableHead>
                <TableHead className="w-[13%]">Actions</TableHead>
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
                    <TableCell className="max-w-[300px]">
                      <div className="flex flex-col gap-1">
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
                        <div
                          className="mt-1 text-xs text-slate-500 whitespace-pre-line"
                          title={formatDescription(meeting.agenda)}
                        >
                          {formatDescription(meeting.agenda) || "No agenda"}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {meeting.departmentIds.length > 0 ? (
                            meeting.departmentIds.map((departmentId) => (
                              <span
                                key={departmentId}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {departmentMap[departmentId] ?? "Unknown"}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No departments</span>
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
                      <button
                        type="button"
                        onClick={() => setAttendeesModal({ isOpen: true, meeting })}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-[#2B3990]"
                        title="View attendees list"
                      >
                        <UsersRound size={14} className="text-slate-400" />
                        <span className="font-medium">
                          {(meeting.internalAttendeeIds?.length || 0) + (meeting.externalAttendees?.length || 0)}
                        </span>
                      </button>
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

      <AttendeesModal
        isOpen={attendeesModal.isOpen}
        onClose={() => setAttendeesModal({ isOpen: false, meeting: null })}
        meeting={attendeesModal.meeting}
        employeeMap={employeeMap}
      />
    </div>
  );
}

function AttendeesModal({ isOpen, onClose, meeting, employeeMap }) {
  if (!isOpen || !meeting) return null;

  const internalAttendees = meeting.internalAttendeeIds || [];
  const externalAttendees = meeting.externalAttendees || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg scale-100 animate-in zoom-in-95 duration-200">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Meeting Participants</h3>
                <p className="text-sm text-slate-500 truncate max-w-[300px]">{meeting.title}</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Internal Attendees */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-md bg-blue-50 p-1 text-blue-600">
                    <User size={16} />
                  </div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Internal Team ({internalAttendees.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {internalAttendees.length > 0 ? (
                    internalAttendees.map((id) => (
                      <div key={id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {(employeeMap[id] || "U").split(" ").map(n => n[0]).join("")}
                          </div>
                          <span className="text-sm font-medium text-slate-700">
                            {employeeMap[id] || "Unknown Employee"}
                          </span>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          Team
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm italic text-slate-400">No internal attendees listed.</p>
                  )}
                </div>
              </div>

              {/* External Attendees */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-md bg-purple-50 p-1 text-purple-600">
                    <Mail size={16} />
                  </div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    External Guests ({externalAttendees.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {externalAttendees.length > 0 ? (
                    externalAttendees.map((guest, index) => (
                      <div key={index} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-slate-700">{guest.name}</span>
                          <span className="text-xs text-slate-500">{guest.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {guest.status === "accepted" ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 size={10} /> Accepted
                            </span>
                          ) : guest.status === "declined" ? (
                            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                              <XCircle size={10} /> Declined
                            </span>
                          ) : guest.status === "tentative" ? (
                            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                              <HelpCircle size={10} /> Tentative
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              <Clock size={10} /> {guest.status === "needsAction" ? "Awaiting" : guest.status || "Invited"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm italic text-slate-400">No external guests listed.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Total: {(internalAttendees.length + externalAttendees.length)} participants
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
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
          <p className="text-xs text-slate-500">Based on current registry filters.</p>
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
