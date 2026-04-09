"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createDocument, deleteDocument, updateDocument, useEmployees } from "@/lib/hooks";
import type { Employee, EmployeeStatus, EmployeeType, NationalityType } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const employeeTypes: EmployeeType[] = ["Management", "Omani", "Expat", "Other", "Household"];
const nationalityOptions: NationalityType[] = ["Omani", "Non-Omani"];
const statusOptions: EmployeeStatus[] = ["active", "on_leave", "terminated"];

const emptyEmployeeForm = {
  employeeId: "",
  name: "",
  email: "",
  phone: "",
  type: "Omani" as EmployeeType,
  nationality: "Omani" as NationalityType,
  position: "",
  department: "",
  joinDate: "",
  status: "active" as EmployeeStatus,
  civilId: "",
  civilIdExpiry: "",
  passportNumber: "",
  passportExpiry: "",
  residencePermitNumber: "",
  residencePermitExpiry: "",
  workPermitNumber: "",
  workPermitExpiry: "",
  laborCardNumber: "",
  laborCardExpiry: "",
  notes: "",
};

function statusVariant(status: EmployeeStatus) {
  if (status === "active") return "green";
  if (status === "on_leave") return "yellow";
  return "red";
}

export function EmployeeManagement() {
  const { data: employees, loading, error } = useEmployees();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [nationalityFilter, setNationalityFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyEmployeeForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || employee.name.toLowerCase().includes(query) || employee.employeeId.includes(query);
      const matchesType = typeFilter === "all" || employee.type === typeFilter;
      const matchesNationality = nationalityFilter === "all" || employee.nationality === nationalityFilter;
      return matchesSearch && matchesType && matchesNationality;
    });
  }, [employees, search, typeFilter, nationalityFilter]);

  function openCreateDialog() {
    setEditingEmployee(null);
    setForm(emptyEmployeeForm);
    setFormError(null);
    setOpen(true);
  }

  function openEditDialog(employee: Employee) {
    setEditingEmployee(employee);
    setForm({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      type: employee.type,
      nationality: employee.nationality,
      position: employee.position,
      department: employee.department,
      joinDate: employee.joinDate,
      status: employee.status,
      civilId: employee.civilId ?? "",
      civilIdExpiry: employee.civilIdExpiry ?? "",
      passportNumber: employee.passportNumber ?? "",
      passportExpiry: employee.passportExpiry ?? "",
      residencePermitNumber: employee.residencePermitNumber ?? "",
      residencePermitExpiry: employee.residencePermitExpiry ?? "",
      workPermitNumber: employee.workPermitNumber ?? "",
      workPermitExpiry: employee.workPermitExpiry ?? "",
      laborCardNumber: employee.laborCardNumber ?? "",
      laborCardExpiry: employee.laborCardExpiry ?? "",
      notes: employee.notes ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!form.employeeId.trim() || !form.name.trim() || !form.email.trim() || !form.joinDate) {
      setFormError("Employee ID, name, email, and join date are required.");
      return;
    }

    const payload = {
      employeeId: form.employeeId.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      type: form.type,
      nationality: form.nationality,
      position: form.position.trim(),
      department: form.department.trim(),
      joinDate: form.joinDate,
      status: form.status,
      civilId: form.civilId.trim(),
      civilIdExpiry: form.civilIdExpiry,
      passportNumber: form.passportNumber.trim(),
      passportExpiry: form.passportExpiry,
      residencePermitNumber: form.residencePermitNumber.trim(),
      residencePermitExpiry: form.residencePermitExpiry,
      workPermitNumber: form.workPermitNumber.trim(),
      workPermitExpiry: form.workPermitExpiry,
      laborCardNumber: form.laborCardNumber.trim(),
      laborCardExpiry: form.laborCardExpiry,
      notes: form.notes.trim(),
    };

    try {
      setSubmitting(true);
      if (editingEmployee) {
        await updateDocument<Employee>("employees", editingEmployee.id, payload);
        toast.success("Employee updated.");
      } else {
        await createDocument("employees", payload);
        toast.success("Employee added.");
      }
      setOpen(false);
      setForm(emptyEmployeeForm);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to save employee.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(employee: Employee) {
    if (!window.confirm(`Delete ${employee.name}?`)) {
      return;
    }

    try {
      await deleteDocument("employees", employee.id);
      toast.success("Employee deleted.");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete employee.";
      toast.error(message);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <EmptyState title="Unable to load employees" description={error} />;
  if (!employees.length) return <EmptyState title="No employees found" description="Run the seed route to add the 23 Bayan employees." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Employee Management</h2>
          <p className="text-sm text-slate-500">Search, filter, add, edit, and maintain employee records.</p>
        </div>
        <Button onClick={openCreateDialog}>Add Employee</Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <Input placeholder="Search by name or employee ID" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            {employeeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={nationalityFilter} onChange={(event) => setNationalityFilter(event.target.value)}>
            <option value="all">All nationalities</option>
            {nationalityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-3">Emp ID</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Nationality</th>
                    <th className="pb-3">Position</th>
                    <th className="pb-3">Join Date</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b last:border-b-0">
                      <td className="py-3">{employee.employeeId}</td>
                      <td className="py-3">
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.email}</p>
                      </td>
                      <td className="py-3">{employee.type}</td>
                      <td className="py-3">{employee.nationality}</td>
                      <td className="py-3">{employee.position || "-"}</td>
                      <td className="py-3">{formatDate(employee.joinDate)}</td>
                      <td className="py-3"><Badge variant={statusVariant(employee.status)}>{employee.status}</Badge></td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(employee)}>Edit</Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(employee)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No matching employees" description="Try adjusting the search text or filters." />
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
            <DialogDescription>All employee records exclude payroll, salary, and banking data.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            {[
              ["employeeId", "Employee ID", "text"],
              ["name", "Full Name", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone", "text"],
              ["position", "Position", "text"],
              ["department", "Department", "text"],
              ["joinDate", "Join Date", "date"],
              ["civilId", "Civil ID Number", "text"],
              ["civilIdExpiry", "Civil ID Expiry", "date"],
              ["passportNumber", "Passport Number", "text"],
              ["passportExpiry", "Passport Expiry", "date"],
              ["residencePermitNumber", "Residence Permit Number", "text"],
              ["residencePermitExpiry", "Residence Permit Expiry", "date"],
              ["workPermitNumber", "Work Permit Number", "text"],
              ["workPermitExpiry", "Work Permit Expiry", "date"],
              ["laborCardNumber", "Labour Card Number", "text"],
              ["laborCardExpiry", "Labour Card Expiry", "date"],
            ].map(([key, label, type]) => (
              <div className="space-y-2" key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select id="type" className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as EmployeeType }))}>
                {employeeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <select id="nationality" className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" value={form.nationality} onChange={(event) => setForm((current) => ({ ...current, nationality: event.target.value as NationalityType }))}>
                {nationalityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EmployeeStatus }))}>
                {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>

            {formError ? <p className="text-sm text-red-600 md:col-span-2">{formError}</p> : null}

            <div className="flex justify-end gap-3 md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editingEmployee ? "Update Employee" : "Create Employee"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
