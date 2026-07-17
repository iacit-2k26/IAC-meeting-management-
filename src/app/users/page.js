"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2, Pencil, Plus, RefreshCw, Search, Shield, Trash2, User, UserPlus, Users, X,
} from "lucide-react";
import TruckLoader from "@/components/TruckLoader";
import StatusBadge from "@/components/ui/StatusBadge";
import DeleteConfirmationModal from "@/components/ui/DeleteConfirmationModal";
import CustomSelect from "@/components/ui/CustomSelect";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const ROLES = ["user", "admin", "ceo", "hod", "mt_office"];

const ROLE_COLORS = {
  admin:     { bg: "bg-violet-50",  text: "text-violet-700",  dot: "#7c3aed" },
  ceo:       { bg: "bg-blue-50",    text: "text-blue-700",    dot: "#2563eb" },
  hod:       { bg: "bg-amber-50",   text: "text-amber-700",   dot: "#d97706" },
  mt_office: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "#16a34a" },
  user:      { bg: "bg-slate-100",  text: "text-slate-600",   dot: "#64748b" },
};

const emptyForm = {
  fullName: "",
  email: "",
  employeeId: "",
  password: "",
  role: "user",
  status: "active",
};

async function readResponse(response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload.data;
}

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role?.toLowerCase()] || ROLE_COLORS.user;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>
      {role || "user"}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("add"); // "add" | "admin" | "mt_office" | "edit"
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, user: null, isDeleting: false });

  const loadData = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = await readResponse(response);
      setUsers(data);
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.fullName, u.email, u.employeeId, u.role, u.department]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [users, query]);

  const openCreate = (preset = {}) => {
    setEditingId(null);
    setForm({ ...emptyForm, ...preset });
    setFeedback({ type: "", message: "" });
    setShowForm(true);
  };

  const openEdit = (user) => {
    setEditingId(user.uid);
    setForm({ fullName: user.fullName, email: user.email, employeeId: user.employeeId, role: user.role, status: user.status || "active", password: "" });
    setFeedback({ type: "", message: "" });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback({ type: "", message: "" });
    try {
      const body = { ...form };
      if (editingId && !body.password) delete body.password;

      const response = await fetch(editingId ? `/api/users/${editingId}` : "/api/users", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await readResponse(response);
      await loadData(true);
      closeForm();
      setFeedback({ type: "success", message: editingId ? "User updated." : "User created." });
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveUser = async (uid) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/users/${uid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      await readResponse(response);
      await loadData(true);
      setFeedback({ type: "success", message: "User approved and activated." });
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.user) return;
    setDeleteModal((p) => ({ ...p, isDeleting: true }));
    try {
      const response = await fetch(`/api/users/${deleteModal.user.uid}`, { method: "DELETE" });
      await readResponse(response);
      await loadData(true);
      setDeleteModal({ isOpen: false, user: null, isDeleting: false });
      setFeedback({ type: "success", message: "User deleted." });
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
      setDeleteModal((p) => ({ ...p, isDeleting: false }));
    }
  };

  const formatDate = (val) => {
    if (!val) return "—";
    return new Date(val).toLocaleString("en-IN", {
      month: "numeric", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const truncateUid = (uid) => uid ? uid.slice(0, 8) + "…" : "—";

  return (
    <>
      {isLoading && <TruckLoader />}
      <div className={isLoading ? "invisible" : "space-y-6"}>
        {/* Header */}
        <section className="-ml-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2B3990]">Administration</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                <Users size={28} className="text-[#2B3990]" /> App Users
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Manage user records and verify new registrations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => openCreate()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77]">
                <UserPlus size={15} /> Add User
              </button>
              <button onClick={() => loadData(false)} disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>
        </section>

        {/* Feedback */}
        {feedback.message && !showForm && (
          <div className={`mx-5 rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}>
            {feedback.message}
          </div>
        )}

        {/* Table */}
        <section className="panel-surface p-5">
          {/* Search */}
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              placeholder="Search by name, email, employee ID, role, department"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-700 focus:outline-none placeholder:text-slate-400"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 transition">
                <X size={14} />
              </button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[15%]">Name</TableHead>
                <TableHead className="w-[18%]">Email</TableHead>
                <TableHead className="w-[9%]">Employee ID</TableHead>
                <TableHead className="w-[10%]">Role</TableHead>
                <TableHead className="w-[12%]">Presence / Status</TableHead>
                <TableHead className="w-[10%]">Department</TableHead>
                <TableHead className="w-[12%]">UID</TableHead>
                <TableHead className="w-[12%]">Last Seen</TableHead>
                <TableHead className="w-[8%]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-400 py-10 italic">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.uid}>
                    <TableCell className="font-semibold text-slate-800">{u.fullName}</TableCell>
                    <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{u.employeeId}</TableCell>
                    <TableCell><RoleBadge role={u.role} /></TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${u.isOnline ? "text-emerald-600" : "text-slate-400"}`}>
                          <span className={`w-2 h-2 rounded-full ${u.isOnline ? "bg-emerald-500" : "bg-slate-300"}`} />
                          {u.isOnline ? "Online" : "Offline"}
                        </span>
                        {u.status === "pending" ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-600/10">
                            Pending Approval
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-600/10">
                            Active
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{u.department || "—"}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-slate-400" title={u.uid}>{truncateUid(u.uid)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(u.lastSeen)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {u.status === "pending" && (
                          <button onClick={() => handleApproveUser(u.uid)}
                            title="Approve User"
                            className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100 transition">
                            <CheckCircle2 size={13} />
                          </button>
                        )}
                        <button onClick={() => openEdit(u)}
                          className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 transition">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteModal({ isOpen: true, user: u, isDeleting: false })}
                          className="rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-100 transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeForm} />
            <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
              <form onSubmit={submitForm} className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{editingId ? "Edit user" : "Add user"}</h2>
                    <p className="text-sm text-slate-500">Manage app login credentials and role.</p>
                  </div>
                  <button type="button" onClick={closeForm}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition">
                    <X size={20} />
                  </button>
                </div>

                {feedback.message && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${
                    feedback.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}>
                    {feedback.message}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" className="sm:col-span-2">
                    <input required value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="input-base" />
                  </Field>
                  <Field label="Email">
                    <input required type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="input-base" />
                  </Field>
                  <Field label="Employee ID">
                    <input required value={form.employeeId} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))} className="input-base" />
                  </Field>
                  <Field label={editingId ? "New password (leave blank to keep)" : "Password"}>
                    <input
                      type="password"
                      value={form.password}
                      required={!editingId}
                      minLength={editingId ? 0 : 8}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      className="input-base"
                      placeholder={editingId ? "Leave blank to keep current" : "Min 8 characters"}
                    />
                  </Field>
                  <Field label="Role">
                    <CustomSelect
                      value={form.role}
                      onChange={(val) => setForm((p) => ({ ...p, role: val }))}
                      options={ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1).replace("_", " ") }))}
                    />
                  </Field>
                  <Field label="Status">
                    <CustomSelect
                      value={form.status}
                      onChange={(val) => setForm((p) => ({ ...p, status: val }))}
                      options={[
                        { value: "active", label: "Active" },
                        { value: "pending", label: "Pending" }
                      ]}
                    />
                  </Field>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={closeForm} disabled={isSubmitting}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className="rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77] disabled:opacity-60">
                    {isSubmitting ? "Saving…" : editingId ? "Update user" : "Create user"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, user: null, isDeleting: false })}
          onConfirm={handleDelete}
          isLoading={deleteModal.isDeleting}
          title="Delete User"
          message={`Are you sure you want to delete ${deleteModal.user?.fullName}? This will remove their login access permanently.`}
        />
      </div>
    </>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
