"use client";

import { AlertCircle, Info, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  useEmployees,
  useLeaveActions,
  useLeaveBalance,
  useLeaveRequests,
  validateLeaveRequest,
} from "@/lib/hooks";
import { getBalanceSummary, leaveTypeBadgeTone, leaveTypeDescriptions, leaveTypeLabels } from "@/lib/leave-policy";
import { disabledDatesForPicker, getNextWorkingDay, isOmanPublicHoliday, isOmanWeekend } from "@/lib/omanCalendar";
import type { LeaveType } from "@/lib/types";

const leaveTypes: LeaveType[] = ["annual", "sick", "maternity", "paternity", "hajj", "bereavement", "emergency", "unpaid"];

export function LeaveRequestForm() {
  const currentYear = new Date().getFullYear();
  const todayIso = new Date().toISOString().slice(0, 10);
  const disabledDates = useMemo(() => new Set(disabledDatesForPicker(currentYear).map((date) => date.toISOString().slice(0, 10))), [currentYear]);
  const { data: employees, loading, error } = useEmployees();
  const { requests } = useLeaveRequests();
  const { submitLeaveRequest } = useLeaveActions();

  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [medicalCert, setMedicalCert] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [childReference, setChildReference] = useState("");
  const [bereavementRelation, setBereavementRelation] = useState<"spouse" | "parent" | "child" | "sibling" | "">("");
  const [hajjConfirmation, setHajjConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedEmployee = useMemo(() => employees.find((employee) => employee.id === employeeId), [employeeId, employees]);
  const { balance } = useLeaveBalance(selectedEmployee?.id ?? "", currentYear);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => !query || employee.name.toLowerCase().includes(query) || employee.employeeId.toLowerCase().includes(query));
  }, [employees, search]);

  const dateMetrics = useMemo(() => {
    if (!startDate || !endDate) {
      return { calendarDays: 0, workingDays: 0, publicHolidays: 0 };
    }
    const validation = validateLeaveRequest({
      employee: selectedEmployee,
      leaveType,
      startDate,
      endDate,
      requests,
      balance,
      year: currentYear,
      medicalCert,
      birthDate,
      childReference,
      bereavementRelation: bereavementRelation || undefined,
      hajjConfirmation,
    });
    const start = new Date(startDate);
    const end = new Date(endDate);
    let publicHolidays = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      if (isOmanPublicHoliday(cursor)) publicHolidays += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return { calendarDays: validation.calendarDays, workingDays: validation.workingDays, publicHolidays };
  }, [balance, bereavementRelation, birthDate, childReference, currentYear, endDate, hajjConfirmation, leaveType, medicalCert, requests, selectedEmployee, startDate]);

  const validation = useMemo(() => validateLeaveRequest({
    employee: selectedEmployee,
    leaveType,
    startDate,
    endDate,
    requests,
    balance,
    year: currentYear,
    medicalCert,
    birthDate,
    childReference,
    bereavementRelation: bereavementRelation || undefined,
    hajjConfirmation,
  }), [balance, bereavementRelation, birthDate, childReference, currentYear, endDate, hajjConfirmation, leaveType, medicalCert, requests, selectedEmployee, startDate]);

  const summary = getBalanceSummary(balance);
  const sickUsed = requests.filter((request) => request.employeeId === selectedEmployee?.id && request.leaveType === "sick" && ["pending", "approved"].includes(request.status)).reduce((sum, request) => sum + request.workingDays, 0);
  const sickProjected = sickUsed + dateMetrics.workingDays;

  function handleDateChange(value: string, setter: (value: string) => void, label: string) {
    if (!value) {
      setter("");
      return;
    }
    const chosen = new Date(value);
    if (value < todayIso) {
      toast.error(`${label} cannot be in the past.`);
      setter("");
      return;
    }
    if (isOmanWeekend(chosen) || disabledDates.has(value)) {
      toast.error(`${label} cannot be on an Oman weekend or public holiday.`);
      setter("");
      return;
    }
    setter(value);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEmployee) {
      toast.error("Please select an employee.");
      return;
    }
    if (leaveType !== "annual" && !reason.trim()) {
      toast.error("Reason is required for this leave type.");
      return;
    }
    if (!validation.valid) {
      toast.error(validation.error ?? "Leave request is not valid.");
      return;
    }

    try {
      setSubmitting(true);
      await submitLeaveRequest({
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeType: selectedEmployee.type,
        leaveType,
        startDate,
        endDate,
        calendarDays: validation.calendarDays,
        workingDays: validation.workingDays,
        status: "pending",
        reason: reason.trim(),
        medicalCert,
        approvedBy: "",
        approvedAt: "",
        rejectedReason: "",
        createdAt: new Date().toISOString(),
        leaveYear: currentYear,
        childReference: childReference.trim() || undefined,
        birthDate: birthDate || undefined,
        bereavementRelation: bereavementRelation || undefined,
        hajjConfirmation,
      });
      toast.success(`Leave request submitted for ${selectedEmployee.name}\n${leaveTypeLabels[leaveType]} · ${startDate} → ${endDate} · ${validation.workingDays} days\nStatus: Pending approval`);
      setSearch("");
      setEmployeeId("");
      setLeaveType("annual");
      setStartDate("");
      setEndDate("");
      setReason("");
      setMedicalCert(false);
      setBirthDate("");
      setChildReference("");
      setBereavementRelation("");
      setHajjConfirmation(false);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <EmptyState title="Unable to load employees" description={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Leave Request</h2>
        <p className="text-sm text-slate-500">Submit leave requests with live Oman Labour Law validation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="mx-auto max-w-3xl space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>Employee</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="Search employees by name or ID" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <select className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <option value="">Select employee</option>
                {filteredEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name} | {employee.employeeId} | {employee.type}</option>
                ))}
              </select>
              {selectedEmployee ? (
                <div className="flex flex-wrap gap-3 rounded-xl border p-3 text-sm">
                  <span>Annual: {summary.annual}</span>
                  <span>Sick: {summary.sick}</span>
                  <span>Emergency: {summary.emergency}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Leave Type</Label>
              <select className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)}>
                {leaveTypes.map((type) => <option key={type} value={type}>{leaveTypeLabels[type]}</option>)}
              </select>
              <div className="rounded-xl border bg-slate-50 p-3 text-sm dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-500" />
                  <span>{leaveTypeDescriptions[leaveType]}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input type="date" min={todayIso} value={startDate} onChange={(event) => handleDateChange(event.target.value, setStartDate, "From Date")} />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input type="date" min={startDate || todayIso} value={endDate} onChange={(event) => handleDateChange(event.target.value, setEndDate, "To Date")} />
              </div>
            </div>

            {startDate && endDate ? (
              <div className="grid gap-3 rounded-xl border p-4 text-sm md:grid-cols-4">
                <div><p className="text-slate-500">Calendar days</p><p className="font-medium">{dateMetrics.calendarDays}</p></div>
                <div><p className="text-slate-500">Working days</p><p className="font-medium">{dateMetrics.workingDays}</p></div>
                <div><p className="text-slate-500">Public holidays</p><p className="font-medium">{dateMetrics.publicHolidays}</p></div>
                <div><p className="text-slate-500">Leave days</p><p className="font-medium">{dateMetrics.workingDays}</p></div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea rows={3} placeholder="Brief reason for leave request..." value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>

            {leaveType === "sick" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={medicalCert} onChange={(event) => setMedicalCert(event.target.checked)} />
                Medical certificate will be provided
              </label>
            ) : null}

            {leaveType === "hajj" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hajjConfirmation} onChange={(event) => setHajjConfirmation(event.target.checked)} />
                I confirm I have not previously taken Hajj leave during my employment at Bayan Investment House
              </label>
            ) : null}

            {leaveType === "maternity" ? (
              <div className="space-y-2">
                <Label>Expected/actual birth date</Label>
                <Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
              </div>
            ) : null}

            {leaveType === "paternity" ? (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Birth date</Label>
                  <Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Child reference</Label>
                  <Input value={childReference} onChange={(event) => setChildReference(event.target.value)} placeholder="Child name or reference" />
                </div>
              </div>
            ) : null}

            {leaveType === "bereavement" ? (
              <div className="space-y-2">
                <Label>Relationship to deceased</Label>
                <select className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm" value={bereavementRelation} onChange={(event) => setBereavementRelation(event.target.value as typeof bereavementRelation)}>
                  <option value="">Select relationship</option>
                  <option value="spouse">Spouse</option>
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="sibling">Sibling</option>
                </select>
              </div>
            ) : null}

            {!validation.valid && selectedEmployee ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>⚠ {selectedEmployee.name} is not eligible for {leaveTypeLabels[leaveType]}: {validation.error}</span>
                </div>
              </div>
            ) : null}

            {leaveType === "sick" && sickProjected > 14 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                <div className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4" /><span>Days 15-28 will be paid at 75% per Oman Labour Law.</span></div>
              </div>
            ) : null}

            {leaveType === "sick" && sickProjected > 28 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                <div className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4" /><span>Days 29-42 will be paid at 50% per Oman Labour Law.</span></div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting || !validation.valid || !selectedEmployee || (leaveType !== "annual" && !reason.trim())}>
                {submitting ? "Submitting..." : "Submit Leave Request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
