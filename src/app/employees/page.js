"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Mail, Pencil, Plus, ShieldCheck, Trash2, Upload, UserSquare2, X, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, employee: null, isDeleting: false });
  // Bulk delete modal state
  const [bulkDeleteModal, setBulkDeleteModal] = useState({ isOpen: false, isDeleting: false });

  // Excel import state
  const fileInputRef = useRef(null);
  const [importModal, setImportModal] = useState({ isOpen: false, rows: [], isImporting: false, result: null });

  const loadData = async (silent = false) => {
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
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
      setIsRefreshing(false);
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
    setShowForm(true);
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
      const response = await fetch(editingId ? `/api/employees/${editingId}` : "/api/employees", {
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
      await loadData(true);
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

  const handleExcelFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected
    event.target.value = "";

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      // Normalise column headers: trim & lowercase
      const rows = raw.map((row) => {
        const normalized = {};
        for (const key of Object.keys(row)) {
          normalized[key.trim().toLowerCase().replace(/\s+/g, "")] = String(row[key]).trim();
        }
        // Map common header aliases to field names
        return {
          employeeId: normalized.employeeid || normalized.empid || normalized.id || "",
          firstName: normalized.firstname || normalized.first || normalized.fname || "",
          lastName: normalized.lastname || normalized.last || normalized.lname || "",
          email: normalized.email || normalized.emailaddress || "",
          designation: normalized.designation || normalized.title || normalized.jobtitle || "",
          departmentId: normalized.departmentid || normalized.deptid || normalized.department || "",
          reportingTo: normalized.reportingto || normalized.manager || normalized.reportsto || "",
          status: normalized.status || "active",
        };
      }).filter((row) => row.employeeId || row.firstName || row.email);

      // Open the modal with the processed rows
      setImportModal({ isOpen: true, rows, isImporting: false, result: null });
    } catch (err) {
      setFeedback({ type: "error", message: `Failed to read Excel file: ${err.message}` });
    }
  };

  const handleImportConfirm = async () => {
    setImportModal((prev) => ({ ...prev, isImporting: true }));
    try {
      // Map department names to IDs
      const departmentNameToIdMap = Object.fromEntries(
        departments.map((d) => [d.name.toLowerCase(), d.id])
      );

      const rowsWithMappedDepartments = importModal.rows.map((row) => {
        const departmentName = row.departmentId?.trim().toLowerCase();
        const mappedDepartmentId = departmentNameToIdMap[departmentName] || row.departmentId;
        return { ...row, departmentId: mappedDepartmentId };
      });

      const response = await fetch("/api/employees/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: rowsWithMappedDepartments }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Import failed.");
      setImportModal((prev) => ({ ...prev, isImporting: false, result: payload.data }));
      await loadData(true);
    } catch (err) {
      setImportModal((prev) => ({ ...prev, isImporting: false }));
      setFeedback({ type: "error", message: err.message });
    }
  };

  const closeImportModal = () => {
    setImportModal({ isOpen: false, rows: [], isImporting: false, result: null });
  };

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId) 
        : [...prev, employeeId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map(emp => emp.id));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteModal(prev => ({ ...prev, isDeleting: true }));
    try {
      console.log("Deleting employees with IDs:", selectedEmployeeIds);
      const response = await fetch("/api/employees", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ employeeIds: selectedEmployeeIds }),
      });
      await readResponse(response);
      await loadData(true);
      setSelectedEmployeeIds([]);
      setFeedback({ type: "success", message: "Selected employees deleted successfully." });
      setBulkDeleteModal({ isOpen: false, isDeleting: false });
    } catch (error) {
      console.error("Bulk delete failed:", error);
      setFeedback({ type: "error", message: error.message });
      setBulkDeleteModal(prev => ({ ...prev, isDeleting: false }));
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

          <div className="flex items-center gap-3">
            {selectedEmployeeIds.length > 0 && (
              <button
                type="button"
                onClick={() => setBulkDeleteModal({ isOpen: true, isDeleting: false })}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
              >
                <Trash2 size={16} />
                Delete {selectedEmployeeIds.length} Selected
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Upload size={16} />
              Import from Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleExcelFile}
            />
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2B3990] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232f77]"
            >
              <Plus size={16} />
              New employee
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={UserSquare2} label="Total people" value={employees.length} color="#2B3990" description="Employees currently registered in the system." />
        <StatCard icon={Building2} label="Departments linked" value={departments.length} color="#7c3aed" description="Business units available for employee assignment." />
        <StatCard icon={ShieldCheck} label="Active accounts" value={activeEmployees} color="#16a34a" description="Employees available for scheduling and hosting." />
      </section>

      <section className="panel-surface p-5">
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Employee directory</h2>
                <p className="text-sm text-slate-500">Search, review, edit, and remove employees.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  placeholder="Search by name, email, or designation"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input-base w-full sm:w-64"
                />
                <CustomSelect
                  value={selectedDepartment}
                  onChange={(val) => setSelectedDepartment(val)}
                  options={[
                    { value: "all", label: "All departments" },
                    ...departments.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={filteredEmployees.length > 0 && selectedEmployeeIds.length === filteredEmployees.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-[#2B3990] focus:ring-[#2B3990]"
                  />
                </TableHead>
                <TableHead className="w-[5%]">ID</TableHead>
                <TableHead className="w-[18%]">Name</TableHead>
                <TableHead className="w-[18%]">Email</TableHead>
                <TableHead className="w-[14%]">Designation</TableHead>
                <TableHead className="w-[14%]">Department</TableHead>
                <TableHead className="w-[12%]">Reports to</TableHead>
                <TableHead className="w-[9%]">Status</TableHead>
                <TableHead className="w-[10%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-500">
                    Loading employees...
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(employee.id)}
                        onChange={() => toggleEmployeeSelection(employee.id)}
                        className="h-4 w-4 rounded border-gray-300 text-[#2B3990] focus:ring-[#2B3990]"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{employee.employeeId}</TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-800">
                        {employee.firstName} {employee.lastName}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Mail size={12} className="shrink-0" />
                        <span className="truncate max-w-[160px]">{employee.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{employee.designation || "—"}</TableCell>
                    <TableCell>{departmentMap[employee.departmentId] ?? "Unknown"}</TableCell>
                    <TableCell className="text-sm text-slate-600">{employee.reportingTo || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={employee.status} color={statusColors[employee.status] ?? "#64748b"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <ActionButton icon={Pencil} label="Edit" onClick={() => startEdit(employee)} />
                        {/* {selectedEmployeeIds.length === 0 && (
                          <ActionButton
                            icon={Trash2}
                            label="Delete"
                            danger
                            onClick={() => removeEmployee(employee)}
                          />
                        )} */}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-500">
                    No employees match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
    </div>

    {/* ── Employee form modal ── */}
    {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={resetForm}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <form onSubmit={submitForm} className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingId ? "Edit employee" : "Create employee"}
                  </h2>
                  <p className="text-sm text-slate-500">All changes save directly to the datastore.</p>
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

              <div className="grid gap-4 sm:grid-cols-2">
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
                  <CustomSelect
                    value={form.departmentId}
                    onChange={(val) => setForm((current) => ({ ...current, departmentId: val }))}
                    placeholder="Select a department"
                    options={[
                      { value: "", label: "Select a department" },
                      ...departments.map((d) => ({ value: d.id, label: d.name })),
                    ]}
                  />
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
              </div>

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
                  {isSubmitting ? "Saving..." : editingId ? "Update employee" : "Create employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    <DeleteConfirmationModal
      isOpen={deleteModal.isOpen}
      onClose={() => setDeleteModal({ isOpen: false, employee: null, isDeleting: false })}
      onConfirm={handleConfirmDelete}
      isLoading={deleteModal.isDeleting}
      title="Delete Employee"
      message={`Are you sure you want to delete ${deleteModal.employee?.firstName} ${deleteModal.employee?.lastName}? This action cannot be undone.`}
    />

    <DeleteConfirmationModal
      isOpen={bulkDeleteModal.isOpen}
      onClose={() => setBulkDeleteModal({ isOpen: false, isDeleting: false })}
      onConfirm={handleBulkDelete}
      isLoading={bulkDeleteModal.isDeleting}
      title="Delete Employees"
      message={`Are you sure you want to delete ${selectedEmployeeIds.length} employees? This action cannot be undone.`}
    />

    <ExcelImportModal
      isOpen={importModal.isOpen}
      rows={importModal.rows}
      isImporting={importModal.isImporting}
      result={importModal.result}
      departments={departments}
      onConfirm={handleImportConfirm}
      onClose={closeImportModal}
    />
    </>
  );
}

function ExcelImportModal({ isOpen, rows, isImporting, result, departments, onConfirm, onClose }) {
  if (!isOpen) return null;

  const departmentMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const departmentNameToIdMap = Object.fromEntries(
    departments.map((d) => [d.name.toLowerCase(), d.id])
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={result ? onClose : undefined}
      />
      <div className="relative w-full max-w-3xl scale-100 animate-in zoom-in-95 duration-200">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#2B3990]/10 p-2 text-[#2B3990]">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Import Employees from Excel</h3>
                  <p className="text-sm text-slate-500">
                    {result
                      ? `Import complete — ${result.imported} added, ${result.failed} failed.`
                      : `${rows.length} record${rows.length !== 1 ? "s" : ""} detected. Review before importing.`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[55vh] overflow-y-auto p-6">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <p className="text-sm font-medium text-emerald-700">
                    Successfully imported {result.imported} employee{result.imported !== 1 ? "s" : ""}.
                  </p>
                </div>
                {result.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Failed rows ({result.errors.length}):</p>
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>
                          <strong>Row {err.index + 1}</strong> ({err.row.firstName} {err.row.lastName}): {err.error}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">No valid rows found in the file.</p>
                <p className="mt-1 text-xs text-slate-400">
                  Make sure the sheet has headers like: Employee ID, First Name, Last Name, Email, Designation, Department ID, Reporting To, Status
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Expected columns: <code className="rounded bg-slate-100 px-1 py-0.5">Employee ID, First Name, Last Name, Email, Designation, Department ID, Reporting To, Status</code>
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-2 pr-3 font-semibold">#</th>
                        <th className="pb-2 pr-3 font-semibold">Emp ID</th>
                        <th className="pb-2 pr-3 font-semibold">Name</th>
                        <th className="pb-2 pr-3 font-semibold">Email</th>
                        <th className="pb-2 pr-3 font-semibold">Designation</th>
                        <th className="pb-2 pr-3 font-semibold">Department</th>
                        <th className="pb-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                          <td className="py-2 pr-3 font-mono text-slate-700">{row.employeeId || <span className="italic text-red-400">missing</span>}</td>
                          <td className="py-2 pr-3 text-slate-700">{row.firstName} {row.lastName}</td>
                          <td className="py-2 pr-3 text-slate-500">{row.email}</td>
                          <td className="py-2 pr-3 text-slate-500">{row.designation || "—"}</td>
                          <td className="py-2 pr-3 text-slate-500">
                            {departmentMap[row.departmentId] || departmentMap[departmentNameToIdMap[row.departmentId?.toLowerCase()]] || row.departmentId || "—"}
                          </td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {row.status || "active"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!result && (
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isImporting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isImporting || rows.length === 0}
                className="rounded-xl bg-[#2B3990] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#232f77] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? "Importing..." : `Import ${rows.length} employee${rows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}
          {result && (
            <div className="flex justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#2B3990] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#232f77]"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
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
