"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, Pencil, Plus, Trash2, Users, X, Mail } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import CustomSelect from "@/components/ui/CustomSelect";
import TruckLoader from "@/components/TruckLoader";
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

const emptyForm = {
  name: "",
  head: "",
  status: "active",
  description: "",
};

async function readResponse(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload.data;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [expandedDepartmentId, setExpandedDepartmentId] = useState(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, department: null, isDeleting: false });

  const loadData = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      const [departmentResponse, employeeResponse] = await Promise.all([
        fetch("/api/departments", { cache: "no-store" }),
        fetch("/api/employees", { cache: "no-store" }),
      ]);

      const [departmentData, employeeData] = await Promise.all([
        readResponse(departmentResponse),
        readResponse(employeeResponse),
      ]);

      setDepartments(departmentData);
      setEmployees(employeeData);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    async function bootstrap() {
      await loadData();
    }

    bootstrap();
  }, []);

  const employeesByDepartment = useMemo(() => {
    return employees.reduce((accumulator, employee) => {
      accumulator[employee.departmentId] = (accumulator[employee.departmentId] || 0) + 1;
      return accumulator;
    }, {});
  }, [employees]);

  const filteredDepartments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return departments;
    }

    return departments.filter((department) =>
      [department.name, department.head, department.description]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [departments, query]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFeedback({ type: "", message: "" });
    setShowForm(true);
  };

  const startEdit = (department) => {
    setEditingId(department.id);
    setForm({
      name: department.name,
      head: department.head,
      status: department.status,
      description: department.description,
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
      const response = await fetch(editingId ? `/api/departments/${editingId}` : "/api/departments", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      await readResponse(response);
      await loadData(true);
      resetForm();
      setFeedback({
        type: "success",
        message: editingId ? "Department updated successfully." : "Department created successfully.",
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeDepartment = (department) => {
    setDeleteModal({ isOpen: true, department, isDeleting: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.department) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      const response = await fetch(`/api/departments/${deleteModal.department.id}`, { method: "DELETE" });
      await readResponse(response);
      await loadData(true);
      if (editingId === deleteModal.department.id) {
        resetForm();
      }
      setFeedback({ type: "success", message: "Department deleted successfully." });
      setDeleteModal({ isOpen: false, department: null, isDeleting: false });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  return (
    <>
      {isLoading && <TruckLoader />}
      <div className={isLoading ? "invisible" : "space-y-6"}>
      <section className="-ml-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2B3990]">
              Module 2
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Department Master
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage departments, assign heads, and control which teams are available for
              meeting scheduling.
            </p>
          </div>

          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77]"
          >
            <Plus size={16} />
            New department
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Building2} label="Total departments" value={departments.length} color="#2B3990" description="Live count from the current dataset." />
        <StatCard
          icon={Users}
          label="Largest team"
          value={departments.length > 0 ? Math.max(...departments.map((d) => employeesByDepartment[d.id] || 0)) : 0}
          color="#16a34a"
          description="Headcount in the biggest department."
        />
        <StatCard
          icon={BriefcaseBusiness}
          label="Active departments"
          value={departments.filter((d) => d.status === "active").length}
          color="#7c3aed"
          description="Departments available for meeting scheduling."
        />
      </section>

      <section className="panel-surface p-5">
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Department directory</h2>
                <p className="text-sm text-slate-500">Edit active teams and review linked headcount.</p>
              </div>
              <input
                placeholder="Search by name, head, or description"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input-base w-full sm:w-72"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Department</TableHead>
                <TableHead className="w-[35%]">Description</TableHead>
                <TableHead className="w-[15%]">Head</TableHead>
                <TableHead className="w-[8%]">Employees</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[10%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    Loading departments...
                  </TableCell>
                </TableRow>
              ) : filteredDepartments.length > 0 ? (
                filteredDepartments.map((department) => (
                  <React.Fragment key={department.id}>
                    <TableRow 
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={(e) => {
                        // Don't expand if clicking on action buttons
                        if (e.target.closest('button')) return;
                        setExpandedDepartmentId(expandedDepartmentId === department.id ? null : department.id);
                      }}
                    >
                      <TableCell>
                        <p className="font-semibold text-slate-800">{department.name}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-500 line-clamp-2">{department.description || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{department.head || "—"}</TableCell>
                      <TableCell className="text-sm font-semibold text-slate-700">{employeesByDepartment[department.id] || 0}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={department.status}
                          color={department.status === "active" ? "#16a34a" : "#94a3b8"}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <ActionButton icon={Pencil} label="Edit" onClick={(e) => { e.stopPropagation(); startEdit(department); }} />
                          <ActionButton
                            icon={Trash2}
                            label="Delete"
                            danger
                            onClick={(e) => { e.stopPropagation(); removeDepartment(department); }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedDepartmentId === department.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-slate-50 border-t border-slate-100">
                          <div className="px-4 py-3">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Department Members</h3>
                            {employees.filter(emp => emp.departmentId === department.id).length > 0 ? (
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-[10%]">ID</TableHead>
                                      <TableHead className="w-[25%]">Name</TableHead>
                                      <TableHead className="w-[25%]">Email</TableHead>
                                      <TableHead className="w-[20%]">Designation</TableHead>
                                      <TableHead className="w-[10%]">Reports to</TableHead>
                                      <TableHead className="w-[10%]">Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {employees.filter(emp => emp.departmentId === department.id).map((emp) => (
                                      <TableRow key={emp.id}>
                                        <TableCell className="font-mono text-xs text-slate-500">{emp.employeeId}</TableCell>
                                        <TableCell>
                                          <p className="font-semibold text-slate-800">
                                            {emp.firstName} {emp.lastName}
                                          </p>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <Mail size={12} className="shrink-0" />
                                            <span className="truncate max-w-[160px]">{emp.email}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">{emp.designation || "—"}</TableCell>
                                        <TableCell className="text-sm text-slate-600">{emp.reportingTo || "—"}</TableCell>
                                        <TableCell>
                                          <StatusBadge status={emp.status} color={emp.status === "active" ? "#16a34a" : "#94a3b8"} />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No members in this department yet.</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No departments match the current search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>

      {/* ── Department form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={resetForm}
          />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <form onSubmit={submitForm} className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingId ? "Edit department" : "Create department"}
                  </h2>
                  <p className="text-sm text-slate-500">Keep the organization structure current and searchable.</p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={20} />
                </button>
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

              <Field label="Department name">
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="input-base"
                />
              </Field>
              <Field label="Department head">
                <input
                  value={form.head}
                  list="department-head-options"
                  onChange={(event) => setForm((current) => ({ ...current, head: event.target.value }))}
                  className="input-base"
                />
                <datalist id="department-head-options">
                  {employees.map((employee) => (
                    <option
                      key={employee.id}
                      value={`${employee.firstName} ${employee.lastName}`}
                    />
                  ))}
                </datalist>
              </Field>
              <Field label="Status">
                  <CustomSelect
                    value={form.status}
                    onChange={(val) => setForm((current) => ({ ...current, status: val }))}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                  />
                </Field>
              <Field label="Description">
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="input-base"
                />
              </Field>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : editingId ? "Update department" : "Create department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, department: null, isDeleting: false })}
        onConfirm={handleConfirmDelete}
        isLoading={deleteModal.isDeleting}
        title="Delete Department"
        message={`Are you sure you want to delete the ${deleteModal.department?.name} department? This action cannot be undone.`}
      />
    </div>
    </>
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
