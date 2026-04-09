"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createDocument, useEmployees, useLeaveRequests } from "@/lib/hooks";
import { getAnnualBalance, getLeaveLimit, leaveTypeLabels, validateLeaveRequest } from "@/lib/leave-policy";
import type { Employee, LeaveType } from "@/lib/types";
import { calculateDateRangeDays } from "@/lib/utils";

const leaveTypes: LeaveType[] = ["annual", "sick", "maternity", "paternity", "emergency", "unpaid", "pilgrimage", "bereavement"];

export function LeaveRequestForm() {
  const { data: employees, loading, error } = useEmployees();
  const { data: leaveRequests } = useLeaveRequests();
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [medicalCertificateRequired, setMedicalCertificateRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedEmployee = useMemo(() => employees.find((employee) => employee.id === employeeId), [employeeId, employees]);
  const days = useMemo(() => calculateDateRangeDays(startDate, endDate), [endDate, startDate]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => !query || employee.name.toLowerCase().includes(query) || employee.employeeId.includes(query));
  }, [employees, search]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateLeaveRequest({
      employee: selectedEmployee,
      leaveType,
      startDate,
      endDate,
      days,
      leaveRequests,
      medicalCertificateRequired,
    });

    if (!reason.trim()) {
      setFormError("Reason is required.");
      return;
    }

    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await createDocument("leaveRequests", {
        employeeId: selectedEmployee?.id,
        employeeName: selectedEmployee?.name,
        type: leaveType,
        startDate,
        endDate,
        days,
        status: "pending",
        reason: reason.trim(),
        createdAt: new Date().toISOString(),
        medicalCertificateRequired,
      });
      toast.success("Leave request submitted.");
      setEmployeeId("");
      setSearch("");
      setLeaveType("annual");
      setStartDate("");
      setEndDate("");
      setReason("");
      setMedicalCertificateRequired(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to submit leave request.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <EmptyState title="Unable to load employees" description={error} />;
  if (!employees.length) return <EmptyState title="No employees found" description="Seed employees before submitting leave requests." />;

  const annualBalance = selectedEmployee ? getAnnualBalance(selectedEmployee, leaveRequests) : null;
  const leaveLimit = getLeaveLimit(leaveType);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Leave Request</h2>
        <p className="text-sm text-slate-500">Submit leave requests with Oman labour law validation before saving to Firestore.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="employee-search">Employee</Label>
              <Input id="employee-search" placeholder="Search employee by name or ID" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <option value="">Select employee</option>
                {filteredEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeId} - {employee.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leaveType">Leave Type</Label>
              <select id="leaveType" className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)}>
                {leaveTypes.map((type) => <option key={type} value={type}>{leaveTypeLabels[type]}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Allowed Limit</Label>
              <div className="flex h-10 items-center rounded-lg border px-3 text-sm">{Number.isFinite(leaveLimit) ? `${leaveLimit} days` : "Approval based"}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">From Date</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">To Date</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex h-10 items-center rounded-lg border px-3 text-sm">{days}</div>
            </div>

            <div className="space-y-2">
              <Label>Remaining Balance</Label>
              <div className="flex h-10 items-center rounded-lg border px-3 text-sm">
                {selectedEmployee && leaveType === "annual" && annualBalance ? `${annualBalance.remaining} days` : leaveType === "sick" ? "Max 70 days/year" : "Rule based"}
              </div>
            </div>

            {leaveType === "sick" ? (
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" checked={medicalCertificateRequired} onChange={(event) => setMedicalCertificateRequired(event.target.checked)} />
                Medical Certificate required
              </label>
            ) : null}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>

            {formError ? <p className="text-sm text-red-600 md:col-span-2">{formError}</p> : null}

            <div className="flex justify-end md:col-span-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Leave Request"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
