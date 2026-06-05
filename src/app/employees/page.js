"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Mail, Pencil, Plus, ShieldCheck, Trash2, UserSquare2 } from "lucide-react";
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
  active: "#16a34a",
  inactive: "#94a3b8",
};

const emptyForm = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  designation: "",
  departmentId: "",
  reportingTo: "",
  status: "active",
};

async function readResponse(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload.data;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, employee: null, isDeleting: false });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [employeeResponse, departmentResponse] = await Promise.all([
        fetch("/api/employees", { cache: "no-store" }),
        fetch("/api/departments", { cache: "no-store" }),
      ]);

      const [employeeData, departmentData] = await Promise.all([
        readResponse(employeeResponse),
        readResponse(departmentResponse),
      ]);

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

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesDepartment = selectedDepartment === "all" || employee.departmentId === selectedDepartment;
      if (!matchesDepartment) return false;

      if (!normalizedQuery) return true;

      return [
        employee.employeeId,
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.designation,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [employees, query, selectedDepartment]);

  const activeEmployees = employees.filter((employee) => employee.status === "active").length;

  const departmentMap = useMemo(
    () => Object.fromEntries(departments.map((department) => [department.id, department.name])),
    [departments]
  );

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFeedback({ type: "", message: "" });
  };

  const startEdit = (employee) => {
    setEditingId(employee.id);
    setForm({
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      designation: employee.designation,
      departmentId: employee.departmentId,
      reportingTo: employee.reportingTo,
      status: employee.status,
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
      const response = await fetch(editingId ? `/api/employees/${editingId}` : "/api/employees", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      await readResponse(response);
      await loadData();
      resetForm();
      setFeedback({
        type: "success",
        message: editingId ? "Employee updated successfully." : "Employee created successfully.",
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeEmployee = (employee) => {
    setDeleteModal({ isOpen: true, employee, isDeleting: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.employee) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      const response = await fetch(`/api/employees/${deleteModal.employee.id}`, { method: "DELETE" });
      await readResponse(response);
      await loadData();
      if (editingId === deleteModal.employee.id) {
        resetForm();
      }
      setFeedback({ type: "success", message: "Employee deleted successfully." });
      setDeleteModal({ isOpen: false, employee: null, isDeleting: false });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  return (
    <div className="space-y-6">
      <section className="-ml-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2B3990]">
              Module 1
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Employee Master
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage employee profiles, department assignment, roles, and meeting availability
              from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77]"
          >
            <Plus size={16} />
            New employee
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel-surface p-5">
          <div className="flex items-center gap-3">
            <UserSquare2 className="text-[#2B3990]" size={20} />
            <div>
              <p className="text-sm font-semibold text-slate-800">Total people</p>
              <p className="text-xs text-slate-500">Employees currently registered in the system.</p>
            </div>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{employees.length}</p>
        </div>

        <div className="panel-surface p-5">
          <div className="flex items-center gap-3">
            <Building2 className="text-[#7c3aed]" size={20} />
            <div>
              <p className="text-sm font-semibold text-slate-800">Departments linked</p>
              <p className="text-xs text-slate-500">Business units available for employee assignment.</p>
            </div>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{departments.length}</p>
        </div>

        <div className="panel-surface p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[#16a34a]" size={20} />
            <div>
              <p className="text-sm font-semibold text-slate-800">Active accounts</p>
              <p className="text-xs text-slate-500">Employees available for scheduling and hosting.</p>
            </div>
          </div>
          <p className="mt-4 text-3xl font-extrabold text-slate-900">{activeEmployees}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <form onSubmit={submitForm} className="panel-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Edit employee" : "Create employee"}
              </h2>
              <p className="text-sm text-slate-500">All changes save directly to the local MVP datastore.</p>
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

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee ID">
              <input
                required
                value={form.employeeId}
                onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="First name">
              <input
                required
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="Last name">
              <input
                required
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="Designation">
              <input
                value={form.designation}
                onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="Reports to">
              <input
                value={form.reportingTo}
                onChange={(event) => setForm((current) => ({ ...current, reportingTo: event.target.value }))}
                className="input-base"
              />
            </Field>
            <Field label="Department">
              <select
                required
                value={form.departmentId}
                onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}
                className="input-base"
              >
                <option value="">Select a department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
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
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : editingId ? "Update employee" : "Create employee"}
          </button>
        </form>

        <section className="panel-surface p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Employee directory</h2>
              <p className="text-sm text-slate-500">Search, review, edit, and remove employees.</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                placeholder="Search by name, email, or designation"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input-base min-w-[240px]"
              />
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="input-base"
              >
                <option value="all">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Reports to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    Loading employees...
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail size={12} />
                          <span>{employee.email}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {employee.employeeId} · {employee.designation || "No designation"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{departmentMap[employee.departmentId] ?? "Unknown"}</TableCell>
                    <TableCell>{employee.reportingTo || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={employee.status} color={statusColors[employee.status] ?? "#64748b"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <ActionButton icon={Pencil} label="Edit" onClick={() => startEdit(employee)} />
                        <ActionButton
                          icon={Trash2}
                          label="Delete"
                          danger
                          onClick={() => removeEmployee(employee)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    No employees match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </section>

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, employee: null, isDeleting: false })}
        onConfirm={handleConfirmDelete}
        isLoading={deleteModal.isDeleting}
        title="Delete Employee"
        message={`Are you sure you want to delete ${deleteModal.employee?.firstName} ${deleteModal.employee?.lastName}? This action cannot be undone.`}
      />
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
