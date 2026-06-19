"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, HelpCircle, Mail, Pencil, Plus, RefreshCw, Search, Trash2, User, UsersRound, X, XCircle } from "lucide-react";
import CustomSelect from "@/components/ui/CustomSelect";
import DateTimePicker from "@/components/ui/DateTimePicker";
import DatePicker from "@/components/ui/DatePicker";
import TruckLoader from "@/components/TruckLoader";
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

const MEETING_TYPES = [
  "Weekly review meeting",
  "Monthly review meeting",
  "Committee meeting",
  "Urgent dept meeting",
  "Cross dept meeting",
  "External meeting",
];

const TYPE_COLORS = {
  "Weekly review meeting":  { bg: "bg-blue-50",    text: "text-blue-700",    bar: "bg-blue-500",    ring: "ring-blue-300"    },
  "Monthly review meeting": { bg: "bg-violet-50",  text: "text-violet-700",  bar: "bg-violet-500",  ring: "ring-violet-300"  },
  "Committee meeting":      { bg: "bg-amber-50",   text: "text-amber-700",   bar: "bg-amber-500",   ring: "ring-amber-300"   },
  "Urgent dept meeting":    { bg: "bg-red-50",     text: "text-red-700",     bar: "bg-red-500",     ring: "ring-red-300"     },
  "Cross dept meeting":     { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", ring: "ring-emerald-300" },
  "External meeting":       { bg: "bg-slate-100",  text: "text-slate-700",   bar: "bg-slate-500",   ring: "ring-slate-300"   },
  "Other":                  { bg: "bg-slate-50",   text: "text-slate-500",   bar: "bg-slate-300",   ring: "ring-slate-200"   },
};

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
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
  const fmt = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}
function isSameWeek(dateStr, weekStart) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return d >= weekStart && d < end;
}

const emptyForm = {
  title: "",
  meetingType: "",
  agenda: "",
  scheduleDateTime: "",
  duration: 30,
  hostId: "emp-f6c99bd2",
  departmentIds: [],
  internalAttendeeIds: [],
  externalAttendeesText: "",
  location: "",
  isVirtual: true,
  attendeeSearch: "",
};

// Meeting templates
const MEETING_TEMPLATES = [
  {
    name: "Weekly Review",
    data: {
      title: "",
      meetingType: "Weekly review meeting",
      agenda: "",
      duration: 60,
      isVirtual: true,
    }
  },
  {
    name: "Monthly Review",
    data: {
      title: "",
      meetingType: "Monthly review meeting",
      agenda: "",
      duration: 90,
      isVirtual: true,
    }
  },
  {
    name: "Committee Meeting",
    data: {
      title: "",
      meetingType: "Committee meeting",
      agenda: "",
      duration: 60,
      isVirtual: true,
    }
  },
  {
    name: "Urgent Department Meeting",
    data: {
      title: "",
      meetingType: "Urgent dept meeting",
      agenda: "",
      duration: 30,
      isVirtual: true,
    }
  },
  {
    name: "Cross-Department Meeting",
    data: {
      title: "",
      meetingType: "Cross dept meeting",
      agenda: "",
      duration: 60,
      isVirtual: true,
    }
  },
  {
    name: "External Meeting",
    data: {
      title: "",
      meetingType: "External meeting",
      agenda: "",
      duration: 45,
      isVirtual: true,
    }
  },
];

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
    .replace(/\n/g, ",")
    .split(",")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // If line is an email (has @)
      if (line.includes("@")) {
        const email = line;
        const name = email.split("@")[0].replace(/[._-]/g, " ");
        return { name, email, status: "invited" };
      }
      
      // If line is just a name (but we need an email for external attendees)
      return null;
    })
    .filter(Boolean);
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, meeting: null, isDeleting: false });
  // Attendees modal state
  const [attendeesModal, setAttendeesModal] = useState({ isOpen: false, meeting: null });

  const loadData = async (silent = false) => {
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
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

      setMeetings(Array.isArray(meetingData) ? meetingData : []);
      setEmployees(Array.isArray(employeeData) ? employeeData : []);
      setDepartments(Array.isArray(departmentData) ? departmentData : []);
    } catch (error) {
      console.error("Error loading meetings data:", error);
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const employeeMap = useMemo(
    () =>
      Object.fromEntries(
        (employees || []).map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`])
      ),
    [employees]
  );

  const departmentMap = useMemo(
    () => Object.fromEntries((departments || []).map((department) => [department.id, department.name])),
    [departments]
  );

  const groupedEmployees = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === "active");
    const groups = {};
    activeEmployees.forEach(emp => {
      const deptId = emp.departmentId;
      if (!groups[deptId]) {
        groups[deptId] = [];
      }
      groups[deptId].push(emp);
    });
    return groups;
  }, [employees]);

  const filteredMeetings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const list = Array.isArray(meetings) ? meetings : [];
    
    return list.filter((meeting) => {
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
        ...(meeting.departmentIds || []).map((departmentId) => departmentMap[departmentId]),
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
    setShowForm(true);
  };

  const startEdit = (meeting) => {
    setEditingId(meeting.id);
    setForm({
      title: meeting.title || "",
      meetingType: meeting.meetingType || "",
      agenda: meeting.agenda || "",
      scheduleDateTime: meeting.scheduleDateTime ? meeting.scheduleDateTime.slice(0, 16) : "",
      duration: meeting.duration || 30,
      hostId: meeting.hostId || "",
      departmentIds: meeting.departmentIds || [],
      internalAttendeeIds: meeting.internalAttendeeIds || [],
      externalAttendeesText: serializeExternalAttendees(meeting.externalAttendees),
      location: meeting.location || "",
      isVirtual: meeting.isVirtual !== undefined ? meeting.isVirtual : true,
      attendeeSearch: "",
    });
    setFeedback({ type: "", message: "" });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(false);
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
      await loadData(true);
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
      await loadData(true);
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
    <>
      {isLoading && <TruckLoader />}
      <div className={`${isLoading ? "hidden" : "block"} space-y-6`}>
      <section className="-ml-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2B3990]">
              Modules 3 & 4
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Meeting Central & Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Create, update, track, and review meetings with internal and external attendees.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#2B3990]/50 bg-blue-50 px-3 py-1.5">
              <CalendarDays size={14} className="text-[#2B3990]" />
              <span className="text-sm font-semibold text-[#2B3990]">
                {filteredMeetings.filter((m) => {
                  const today = new Date().toLocaleDateString("en-CA");
                  return new Date(m.scheduleDateTime).toLocaleDateString("en-CA") === today && m.status === "upcoming";
                }).length} upcoming today
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadData(false)}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
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

      <section className="panel-surface p-5">
          <WeeklyBreakdown meetings={meetings} employeeMap={employeeMap} departmentMap={departmentMap} />
      </section>

      <section className="panel-surface p-5">
          <div className="mb-6 space-y-3">
            {/* Row 1 — title + search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Meeting registry</h2>
                <p className="text-sm text-slate-500">Review meetings, open details, edit scheduling, or remove entries.</p>
              </div>
              <input
                placeholder="Search by title, host, department, or meeting ID"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input-base w-full sm:w-72"
              />
            </div>
            {/* Row 2 — date range */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-500">From</span>
                <div className="w-40">
                  <DatePicker
                    value={dateRange.start}
                    onChange={(val) => setDateRange(prev => ({ ...prev, start: val }))}
                    placeholder="Start date"
                  />
                </div>
              </div>
              <span className="text-slate-300 font-bold">|</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">To</span>
                <div className="w-40">
                  <DatePicker
                    value={dateRange.end}
                    onChange={(val) => setDateRange(prev => ({ ...prev, end: val }))}
                    placeholder="End date"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setDateRange({ start: today, end: today });
                }}
                className="px-4 py-2 bg-[#2B3990] text-white text-xs font-bold rounded-lg hover:bg-[#232e74] transition-colors shadow-sm"
              >
                Today
              </button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[33%]">Meeting</TableHead>
                <TableHead className="w-[11%]">Host</TableHead>
                <TableHead className="w-[13%]">Departments</TableHead>
                <TableHead className="w-[7%]">Attendees</TableHead>
                <TableHead className="w-[13%]">Schedule</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[13%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    Loading meetings...
                  </TableCell>
                </TableRow>
              ) : filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell className="max-w-[260px]">
                      <div className="flex flex-col gap-1">
                        {meeting.isVirtual ? (
                          <span className="font-semibold text-slate-800">
                            {meeting.title}{meeting.meetingType ? ` – ${meeting.meetingType}` : ""}
                          </span>
                        ) : (
                          <Link
                            href={`/meetings/${meeting.id}`}
                            className="font-semibold text-slate-800 hover:text-[#2B3990]"
                          >
                            {meeting.title}{meeting.meetingType ? ` – ${meeting.meetingType}` : ""}
                          </Link>
                        )}
                        <div
                          className="mt-1 text-xs text-slate-500 line-clamp-4"
                          title={formatDescription(meeting.agenda)}
                        >
                          {stripNewlines(formatDescription(meeting.agenda)) || "No agenda"}
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
                      <div className="flex flex-wrap gap-1">
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
                          <span className="text-[10px] text-slate-400 italic">—</span>
                        )}
                      </div>
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
                        {meeting.hostId !== "external" && (
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
                        {meeting.hostId === "external" && meeting.id.startsWith("gcal-") && (
                          <ActionButton
                            icon={Trash2}
                            label="Delete"
                            danger
                            onClick={() => removeMeeting(meeting)}
                          />
                        )}
                        {meeting.hostId === "external" && !meeting.id.startsWith("gcal-") && (
                          <span className="text-xs text-slate-400 italic">External Event</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    No meetings match the current search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>

     {/* ── Meeting form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={resetForm}
          />
          <div className="relative w-full max-w-5xl max-h-[85vh] flex flex-col">
            <form onSubmit={submitForm} className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              {/* Fixed header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-slate-100 shrink-0">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingId ? "Edit meeting" : "Create meeting"}
                  </h2>
                  <p className="text-xs text-slate-500">Meetings are automatically synchronized with enterprise conferencing APIs.</p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto px-4 py-3 space-y-2.5 flex-1 min-h-0">
                {feedback.message && (
                  <div
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      feedback.type === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                {/* Template Selection */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-700">Use a template (optional)</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {MEETING_TEMPLATES.map((template, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          ...template.data
                        }))}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-colors"
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <Field label="Meeting title" className="lg:col-span-2">
                    <input
                      required
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      className="input-base"
                    />
                  </Field>
                  <Field label="Meeting type (optional)">
                    <CustomSelect
                      value={form.meetingType}
                      onChange={(val) => setForm((current) => ({ ...current, meetingType: val }))}
                      placeholder="— None —"
                      options={[
                        { value: "", label: "— None —" },
                        ...MEETING_TYPES.map((t) => ({ value: t, label: t })),
                      ]}
                    />
                  </Field>
                </div>
                <Field label="Agenda">
                  <textarea
                    required
                    rows={2}
                    value={form.agenda}
                    onChange={(event) => setForm((current) => ({ ...current, agenda: event.target.value }))}
                    placeholder="Provide a brief description or agenda for the meeting."
                    className="input-base"
                  />
                </Field>
                <div className="grid gap-3 lg:grid-cols-4">
                  <Field label="Schedule" className="lg:col-span-2">
                    <DateTimePicker
                      value={form.scheduleDateTime}
                      onChange={(e) => setForm((current) => ({ ...current, scheduleDateTime: e.target.value }))}
                      placeholder="Select date and time"
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
                  <Field label="Host">
                    <CustomSelect
                      searchable
                      value={form.hostId}
                      onChange={(val) => setForm((current) => {
                        return { ...current, hostId: val };
                      })}
                      placeholder="Select a host"
                      options={[
                        { value: "", label: "Select a host" },
                        ...employees
                          .filter((e) => e.status === "active")
                          .map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))
                      ]}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="Location Preference">
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="locationType"
                          checked={form.isVirtual}
                          onChange={() => setForm(prev => ({ ...prev, isVirtual: true, location: "" }))}
                          className="h-3.5 w-3.5 text-[#2B3990] border-slate-300 focus:ring-[#2B3990]"
                        />
                        <span className="text-sm font-medium text-slate-700">Online (Zoom)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="locationType"
                          checked={!form.isVirtual}
                          onChange={() => setForm(prev => ({ ...prev, isVirtual: false }))}
                          className="h-3.5 w-3.5 text-[#2B3990] border-slate-300 focus:ring-[#2B3990]"
                        />
                        <span className="text-sm font-medium text-slate-700">In Person + Zoom</span>
                      </label>
                    </div>
                  </Field>

                  {!form.isVirtual && (
                    <Field label="Physical Location">
                      <input
                        required
                        value={form.location}
                        onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                        placeholder="e.g., Conference Room A, Floor 2"
                        className="input-base"
                      />
                    </Field>
                  )}
                </div>

               <div className="grid gap-3 lg:grid-cols-2">
  <ChecklistGroup
    className="h-44"
    title="Departments"
    items={departments.map((department) => ({ id: department.id, label: department.name }))}
    selectedItems={form.departmentIds}
    onToggle={handleDepartmentToggle}
  />

  <div className="flex h-44 flex-col">
    <p className="mb-1 text-xs font-semibold text-slate-700">Internal attendees</p>
    <div className="relative mb-1.5">
      <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        placeholder="Search employees..."
        value={form.attendeeSearch || ""}
        onChange={(e) => setForm(prev => ({ ...prev, attendeeSearch: e.target.value }))}
        className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#2B3990]/30"
      />
    </div>
    <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-1.5">
      {departments.map(dept => {
        const deptEmployees = groupedEmployees[dept.id] || [];
        const searchTerm = (form.attendeeSearch || "").toLowerCase();
        const filteredDeptEmployees = deptEmployees.filter(emp => 
          `${emp.firstName} ${emp.lastName} · ${emp.designation || emp.role}`.toLowerCase().includes(searchTerm)
        );
        if (filteredDeptEmployees.length === 0) return null;
        
        return (
          <div key={dept.id} className="space-y-0.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">{dept.name}</p>
            {filteredDeptEmployees.map(emp => {
              const checked = form.internalAttendeeIds.includes(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleArrayValue("internalAttendeeIds", emp.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors ${
                    checked
                      ? "bg-[#2B3990]/8 text-[#2B3990]"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-all ${
                    checked
                      ? "border-[#2B3990] bg-[#2B3990]"
                      : "border-slate-300 bg-white"
                  }`}>
                    {checked && (
                      <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="leading-snug">{emp.firstName} {emp.lastName} · {emp.designation || emp.role}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      {/* Show employees without department (if any) */}
      {(() => {
        const searchTerm = (form.attendeeSearch || "").toLowerCase();
        const employeesWithoutDept = employees.filter(
          e => e.status === "active" && !e.departmentId && 
          `${e.firstName} ${e.lastName} · ${e.designation || e.role}`.toLowerCase().includes(searchTerm)
        );
        if (employeesWithoutDept.length === 0) return null;
        
        return (
          <div key="no-dept" className="space-y-0.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Other</p>
            {employeesWithoutDept.map(emp => {
              const checked = form.internalAttendeeIds.includes(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleArrayValue("internalAttendeeIds", emp.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors ${
                    checked
                      ? "bg-[#2B3990]/8 text-[#2B3990]"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-all ${
                    checked
                      ? "border-[#2B3990] bg-[#2B3990]"
                      : "border-slate-300 bg-white"
                  }`}>
                    {checked && (
                      <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="leading-snug">{emp.firstName} {emp.lastName} · {emp.designation || emp.role}</span>
                </button>
              );
            })}
          </div>
        );
      })()}
    </div>
  </div>
</div>

                <Field label="External attendees">
                  <textarea
                    rows={2}
                    value={form.externalAttendeesText}
                    onChange={(event) => setForm((current) => ({ ...current, externalAttendeesText: event.target.value }))}
                    placeholder="One attendee per line: Name, email@example.com, invited"
                    className="input-base"
                  />
                </Field>
              </div>

              {/* Fixed footer */}
              <div className="flex justify-end gap-2.5 px-4 py-2.5 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-[#2B3990] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : editingId ? "Update meeting" : "Create meeting"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, meeting: null, isDeleting: false })}
        onConfirm={handleConfirmDelete}
        isLoading={deleteModal.isDeleting}
        title="Delete Meeting"
        message={`Are you sure you want to delete "${deleteModal.meeting?.title}"? This will also cancel the meeting on all linked calendars and cannot be undone.`}
      />

      <AttendeesModal
        isOpen={attendeesModal.isOpen}
        onClose={() => setAttendeesModal({ isOpen: false, meeting: null })}
        meeting={attendeesModal.meeting}
        employeeMap={employeeMap}
      />
    </div>
    </>
  );
}

function AttendeesModal({ isOpen, onClose, meeting, employeeMap }) {
  if (!isOpen || !meeting) return null;

  const internalAttendees = meeting.internalAttendeeIds || [];
  const externalAttendees = meeting.externalAttendees || [];
  const internalStatuses = meeting.internalAttendeeStatuses || {};

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
                        <div className="flex items-center gap-2">
                          {internalStatuses[id] === "accepted" ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              <CheckCircle2 size={10} /> Accepted
                            </span>
                          ) : internalStatuses[id] === "declined" ? (
                            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                              <XCircle size={10} /> Declined
                            </span>
                          ) : internalStatuses[id] === "tentative" ? (
                            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                              <HelpCircle size={10} /> Tentative
                            </span>
                          ) : internalStatuses[id] ? (
                            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              <Clock size={10} /> {internalStatuses[id] === "needsAction" ? "Awaiting" : internalStatuses[id]}
                            </span>
                          ) : (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                              Team
                            </span>
                          )}
                        </div>
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

function WeeklyBreakdown({ meetings, employeeMap, departmentMap }) {
  const todayWeekStart = useMemo(() => getWeekStart(new Date()), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [drillType, setDrillType] = useState(null); // null = none open

  const currentWeekStart = useMemo(() => addWeeks(todayWeekStart, weekOffset), [todayWeekStart, weekOffset]);

  const presets = [
    { label: "Last week", offset: -1 },
    { label: "This week", offset: 0 },
    { label: "Next week", offset: 1 },
    { label: "Week +2",   offset: 2 },
  ];

  const weekMeetings = useMemo(
    () => meetings.filter((m) => isSameWeek(m.scheduleDateTime, currentWeekStart)),
    [meetings, currentWeekStart]
  );

  const breakdown = useMemo(() => {
    const counts = {};
    for (const m of weekMeetings) {
      const key = m.meetingType && MEETING_TYPES.includes(m.meetingType) ? m.meetingType : "Other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [weekMeetings]);

  const maxCount = Math.max(...Object.values(breakdown), 1);
  const displayTypes = [
    ...MEETING_TYPES.filter((t) => breakdown[t] > 0),
    ...(breakdown["Other"] > 0 ? ["Other"] : []),
  ];

  const drillMeetings = useMemo(() => {
    if (!drillType) return [];
    return weekMeetings.filter((m) => {
      const key = m.meetingType && MEETING_TYPES.includes(m.meetingType) ? m.meetingType : "Other";
      return key === drillType;
    }).sort((a, b) => new Date(a.scheduleDateTime) - new Date(b.scheduleDateTime));
  }, [drillType, weekMeetings]);

  const handleTypeClick = (type) => {
    setDrillType((prev) => (prev === type ? null : type));
  };

  // Reset drill when week changes
  const changeWeek = (newOffset) => {
    setWeekOffset(newOffset);
    setDrillType(null);
  };

  return (
    <div>
      {/* Header row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Meeting types by week</h2>
          <p className="text-sm text-slate-500">
            {weekMeetings.length} meeting{weekMeetings.length !== 1 ? "s" : ""} — click a count to see details.
          </p>
        </div>
        {/* Week nav */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => changeWeek(weekOffset - 1)}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 transition">
            <ChevronLeft size={15} />
          </button>
          {presets.map((p) => (
            <button key={p.offset} onClick={() => changeWeek(p.offset)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                weekOffset === p.offset
                  ? "bg-[#2B3990] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => changeWeek(weekOffset + 1)}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 transition">
            <ChevronRight size={15} />
          </button>
          <span className="ml-1 text-xs font-semibold text-slate-500">{formatWeekLabel(currentWeekStart)}</span>
        </div>
      </div>

      {weekMeetings.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400 italic">No meetings scheduled for this week.</p>
      ) : displayTypes.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400 italic">No meetings with a type set this week.</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          {/* Left — bar chart */}
          <div className="space-y-3">
            {displayTypes.map((type) => {
              const count = breakdown[type] || 0;
              const colors = TYPE_COLORS[type] || TYPE_COLORS["Other"];
              const pct = Math.round((count / maxCount) * 100);
              const isActive = drillType === type;
              return (
                <div key={type}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 transition cursor-pointer ${
                    isActive ? `ring-2 ${colors.ring} ${colors.bg}` : "hover:bg-slate-50"
                  }`}
                  onClick={() => handleTypeClick(type)}
                >
                  <span className={`w-40 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${colors.text}`}>
                    {type}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2.5">
                    <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTypeClick(type); }}
                    className={`w-8 shrink-0 text-right text-sm font-bold transition ${
                      isActive ? colors.text : "text-slate-700 hover:" + colors.text
                    }`}
                  >
                    {count}
                  </button>
                </div>
              );
            })}
            {breakdown["Other"] > 0 && (
              <p className="pt-1 text-xs text-slate-400 italic pl-1">* "Other" = meetings with no type set.</p>
            )}
          </div>

          {/* Right — drill-down list */}
          <div>
            {drillType ? (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${(TYPE_COLORS[drillType] || TYPE_COLORS["Other"]).bg} ${(TYPE_COLORS[drillType] || TYPE_COLORS["Other"]).text}`}>
                      {drillType}
                    </span>
                    <span className="text-sm text-slate-500">{drillMeetings.length} meeting{drillMeetings.length !== 1 ? "s" : ""}</span>
                  </div>
                  <button onClick={() => setDrillType(null)} className="text-slate-400 hover:text-slate-600 transition">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {drillMeetings.map((m) => (
                    <div key={m.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {m.isVirtual ? (
                          <p className="text-sm font-semibold text-slate-800 truncate">{m.title}</p>
                        ) : (
                          <Link href={`/meetings/${m.id}`} className="text-sm font-semibold text-slate-800 hover:text-[#2B3990] truncate block">
                            {m.title}
                          </Link>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{formatDateTime(m.scheduleDateTime)}</span>
                          {employeeMap[m.hostId] && (
                            <span className="text-slate-400">· {employeeMap[m.hostId]}</span>
                          )}
                          {m.departmentIds?.length > 0 && (
                            <span className="text-slate-400">
                              · {m.departmentIds.map((id) => departmentMap[id] ?? "?").join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={m.status} color={statusColors[m.status] ?? "#64748b"} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 text-center p-6">
                <p className="text-sm font-medium text-slate-400">Click a count on the left to see meetings for that type.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ChecklistGroup({ title, items, selectedItems, onToggle, searchable = false, className = "" }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchable) return items;
    return items.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchable, searchQuery]);

  return (
    <div className={`flex flex-col ${className}`}>
      <p className="mb-1 text-xs font-semibold text-slate-700">{title}</p>
      {searchable && (
        <div className="mb-1.5 relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#2B3990]/30"
          />
        </div>
      )}
      <div className="flex-1 min-h-0 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-1.5">
        {filteredItems.length === 0 && (
          <p className="py-2 text-center text-xs text-slate-400 italic">No items found.</p>
        )}
        {filteredItems.map((item) => {
          const checked = selectedItems.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors ${
                checked
                  ? "bg-[#2B3990]/8 text-[#2B3990]"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-all ${
                checked
                  ? "border-[#2B3990] bg-[#2B3990]"
                  : "border-slate-300 bg-white"
              }`}>
                {checked && (
                  <svg width="8" height="6" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className="leading-snug">{item.label}</span>
            </button>
          );
        })}
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
