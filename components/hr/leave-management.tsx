"use client";

import { Fragment, useMemo, useState } from "react";
import { Check, ChevronDown, Download, X } from "lucide-react";
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
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  createDefaultLeaveBalance,
  useAllLeaveBalances,
  useEmployees,
  useLeaveActions,
  useLeaveRequests,
} from "@/lib/hooks";
import { getLeaveBucket, leaveTypeBadgeTone, leaveTypeLabels, requestCanBeCancelled } from "@/lib/leave-policy";
import type { Employee, LeaveBalance, LeaveRequest, LeaveType } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function formatRelativeTime(iso: string) {
  const value = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(value / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  return formatter.format(days, "day");
}

function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function getStatusBadge(status: LeaveRequest["status"]) {
  if (status === "approved") return "green" as const;
  if (status === "pending") return "yellow" as const;
  if (status === "rejected") return "red" as const;
  return "gray" as const;
}

function getBalanceMap(employees: Employee[], balances: LeaveBalance[], year: number) {
  const map = new Map<string, LeaveBalance>();
  balances.forEach((balance) => map.set(balance.employeeId, balance));
  employees.forEach((employee) => {
    if (!map.has(employee.id)) {
      map.set(employee.id, { id: `${employee.id}_${year}`, ...createDefaultLeaveBalance(employee.id, year) });
    }
  });
  return map;
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LeaveManagement() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const { user } = useAuth();
  const { data: employees, loading: employeesLoading, error: employeesError } = useEmployees();
  const { requests, loading: requestsLoading, error: requestsError } = useLeaveRequests();
  const [balanceYear, setBalanceYear] = useState(currentYear);
  const { balances, loading: balancesLoading, error: balancesError } = useAllLeaveBalances(balanceYear);
  const { approveLeave, rejectLeave, cancelLeave } = useLeaveActions();

  const [activeTab, setActiveTab] = useState<"pending" | "all" | "balances">("pending");
  const [search, setSearch] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LeaveRequest["status"] | "all">("all");
  const [monthFilter, setMonthFilter] = useState<string>(String(currentMonth));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectState, setRejectState] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);

  const balanceMap = useMemo(() => getBalanceMap(employees, balances, balanceYear), [balanceYear, balances, employees]);

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === "pending"), [requests]);
  const approvedThisMonth = useMemo(
    () => requests.filter((request) => request.status === "approved" && new Date(request.approvedAt ?? request.createdAt).getMonth() + 1 === currentMonth).length,
    [currentMonth, requests],
  );
  const rejectedThisMonth = useMemo(
    () => requests.filter((request) => request.status === "rejected" && new Date(request.createdAt).getMonth() + 1 === currentMonth).length,
    [currentMonth, requests],
  );
  const totalThisYear = useMemo(() => requests.filter((request) => request.leaveYear === currentYear).length, [currentYear, requests]);

  const allFilteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesSearch = !search.trim() || request.employeeName.toLowerCase().includes(search.toLowerCase());
      const matchesType = leaveTypeFilter === "all" || request.leaveType === leaveTypeFilter;
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesMonth = monthFilter === "all" || new Date(request.startDate).getMonth() + 1 === Number(monthFilter);
      return matchesSearch && matchesType && matchesStatus && matchesMonth;
    });
  }, [leaveTypeFilter, monthFilter, requests, search, statusFilter]);

  const employeeHistory = useMemo(() => {
    if (!historyEmployee) return [];
    return requests.filter((request) => request.employeeId === historyEmployee.id);
  }, [historyEmployee, requests]);

  async function handleApprove(request: LeaveRequest) {
    try {
      await approveLeave(request.id, user?.email ?? "hr@bayaninvestment.com");
      toast.success(`Leave approved for ${request.employeeName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve leave request.");
    }
  }

  async function handleReject() {
    if (!rejectState) return;
    try {
      await rejectLeave(rejectState.id, rejectReason.trim());
      toast.success(`Leave rejected for ${rejectState.name}`);
      setRejectReason("");
      setRejectState(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reject leave request.");
    }
  }

  async function handleCancel(request: LeaveRequest) {
    try {
      await cancelLeave(request.id);
      toast.success(`Leave cancelled for ${request.employeeName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel leave request.");
    }
  }

  function exportBalances() {
    const rows = [
      ["Employee", "Type", "Annual", "Sick", "Emergency", "Hajj", "Maternity", "Paternity"],
      ...employees.map((employee) => {
        const balance = balanceMap.get(employee.id) ?? { id: `${employee.id}_${balanceYear}`, ...createDefaultLeaveBalance(employee.id, balanceYear) };
        return [
          employee.name,
          employee.type,
          `${balance.annual.used}/${balance.annual.entitled}`,
          `${balance.sick.used}/${balance.sick.entitled}`,
          `${balance.emergency.used}/${balance.emergency.entitled}`,
          balance.hajj.everTaken ? "Taken" : "Eligible",
          `${balance.maternity.used}/${balance.maternity.entitled}`,
          `${balance.paternity.used}/${balance.paternity.entitled}`,
        ];
      }),
    ];
    downloadCsv(rows, `BayanHR_LeaveBalances_${balanceYear}.csv`);
  }

  if (employeesLoading || requestsLoading || balancesLoading) return <Spinner />;
  if (employeesError || requestsError || balancesError) {
    return <EmptyState title="Unable to load leave management" description={employeesError ?? requestsError ?? balancesError ?? "Please check Firebase access."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Leave Management</h2>
          <p className="text-sm text-slate-500">Royal Decree 35/2003 aligned leave approvals, request history, and yearly balances.</p>
        </div>
        {activeTab === "balances" ? <Button onClick={exportBalances}><Download className="mr-2 h-4 w-4" />Export CSV</Button> : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant={activeTab === "pending" ? "default" : "outline"} onClick={() => setActiveTab("pending")}>Pending</Button>
        <Button variant={activeTab === "all" ? "default" : "outline"} onClick={() => setActiveTab("all")}>All Requests</Button>
        <Button variant={activeTab === "balances" ? "default" : "outline"} onClick={() => setActiveTab("balances")}>Balances</Button>
      </div>

      {activeTab === "pending" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              [`Pending Approval`, String(pendingRequests.length), "yellow"],
              [`Approved This Month`, String(approvedThisMonth), "green"],
              [`Rejected This Month`, String(rejectedThisMonth), "red"],
              [`Total Requests This Year`, String(totalThisYear), "default"],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-2xl border bg-white p-4 dark:bg-slate-950">
                <Badge variant={tone as "default" | "green" | "yellow" | "red"}>{label}</Badge>
                <p className="mt-3 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              {pendingRequests.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-3">Employee</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Dates</th>
                        <th className="pb-3">Days</th>
                        <th className="pb-3">Balance</th>
                        <th className="pb-3">Reason</th>
                        <th className="pb-3">Submitted</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((request) => {
                        const balance = balanceMap.get(request.employeeId) ?? { id: `${request.employeeId}_${currentYear}`, ...createDefaultLeaveBalance(request.employeeId, currentYear) };
                        const bucket = getLeaveBucket(balance, request.leaveType);
                        return (
                          <tr key={request.id} className="border-b last:border-b-0">
                            <td className="py-3">
                              <p className="font-medium">{request.employeeName}</p>
                              <Badge variant="gray">{request.employeeId}</Badge>
                            </td>
                            <td className="py-3"><Badge variant={leaveTypeBadgeTone[request.leaveType]}>{leaveTypeLabels[request.leaveType]}</Badge></td>
                            <td className="py-3">{formatDate(request.startDate)} → {formatDate(request.endDate)}</td>
                            <td className="py-3">{request.workingDays}</td>
                            <td className="py-3 text-xs text-slate-500">{bucket.remaining ?? 0} / {bucket.entitled} remaining</td>
                            <td className="py-3" title={request.reason}>{truncate(request.reason, 40)}</td>
                            <td className="py-3">{formatRelativeTime(request.createdAt)}</td>
                            <td className="py-3">
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleApprove(request)}><Check className="mr-1 h-4 w-4" />Approve</Button>
                                <Button size="sm" variant="outline" className="border-red-300 text-red-600" onClick={() => setRejectState({ id: request.id, name: request.employeeName })}><X className="mr-1 h-4 w-4" />Reject</Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="All caught up — no pending leave requests" description="New leave requests will appear here for HR review." />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "all" ? (
        <Card>
          <CardHeader>
            <CardTitle>All Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Input placeholder="Search by employee name" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={leaveTypeFilter} onChange={(event) => setLeaveTypeFilter(event.target.value as LeaveType | "all") }>
                <option value="all">All leave types</option>
                {Object.keys(leaveTypeLabels).map((type) => <option key={type} value={type}>{leaveTypeLabels[type as LeaveType]}</option>)}
              </select>
              <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeaveRequest["status"] | "all") }>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}>
                <option value="all">All months</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={String(month)}>{new Date(currentYear, month - 1, 1).toLocaleString("en", { month: "short" })}</option>)}
              </select>
              <button className="text-left text-sm text-teal-700" onClick={() => { setSearch(""); setLeaveTypeFilter("all"); setStatusFilter("all"); setMonthFilter(String(currentMonth)); }}>Clear filters</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Dates</th>
                    <th className="pb-3">Days</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Reason</th>
                    <th className="pb-3">Submitted</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allFilteredRequests.map((request) => (
                    <Fragment key={request.id}>
                      <tr key={request.id} className="border-b last:border-b-0">
                        <td className="py-3">{request.employeeName}</td>
                        <td className="py-3"><Badge variant={leaveTypeBadgeTone[request.leaveType]}>{leaveTypeLabels[request.leaveType]}</Badge></td>
                        <td className="py-3">{formatDate(request.startDate)} → {formatDate(request.endDate)}</td>
                        <td className="py-3">{request.workingDays}</td>
                        <td className="py-3"><Badge variant={getStatusBadge(request.status)}>{request.status}</Badge></td>
                        <td className="py-3">{truncate(request.reason, 40)}</td>
                        <td className="py-3">{formatRelativeTime(request.createdAt)}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setExpandedId((current) => current === request.id ? null : request.id)}><ChevronDown className="mr-1 h-4 w-4" />Details</Button>
                            {request.status === "pending" ? <Button size="sm" onClick={() => handleApprove(request)}>Approve</Button> : null}
                            {request.status === "pending" ? <Button size="sm" variant="outline" className="border-red-300 text-red-600" onClick={() => setRejectState({ id: request.id, name: request.employeeName })}>Reject</Button> : null}
                            {requestCanBeCancelled(request) ? <Button size="sm" variant="outline" onClick={() => handleCancel(request)}>Cancel</Button> : null}
                          </div>
                        </td>
                      </tr>
                      {expandedId === request.id ? (
                        <tr className="border-b bg-slate-50/70 dark:bg-slate-900/40">
                          <td className="py-4" colSpan={8}>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <div><p className="text-xs uppercase text-slate-500">Full reason</p><p>{request.reason || "-"}</p></div>
                              <div><p className="text-xs uppercase text-slate-500">Medical certificate</p><p>{request.medicalCert ? "Provided" : "Not required"}</p></div>
                              <div><p className="text-xs uppercase text-slate-500">Approved by</p><p>{request.approvedBy || "-"}</p></div>
                              <div><p className="text-xs uppercase text-slate-500">Approved at</p><p>{request.approvedAt ? formatDate(request.approvedAt) : "-"}</p></div>
                              <div><p className="text-xs uppercase text-slate-500">Calendar days</p><p>{request.calendarDays}</p></div>
                              <div><p className="text-xs uppercase text-slate-500">Working days</p><p>{request.workingDays}</p></div>
                              <div><p className="text-xs uppercase text-slate-500">Rejected reason</p><p>{request.rejectedReason || "-"}</p></div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "balances" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Balances</CardTitle>
              <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={String(balanceYear)} onChange={(event) => setBalanceYear(Number(event.target.value))}>
                {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Annual</th>
                    <th className="pb-3">Sick</th>
                    <th className="pb-3">Emergency</th>
                    <th className="pb-3">Hajj</th>
                    <th className="pb-3">Maternity</th>
                    <th className="pb-3">Paternity</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    const balance = balanceMap.get(employee.id) ?? { id: `${employee.id}_${balanceYear}`, ...createDefaultLeaveBalance(employee.id, balanceYear) };
                    const annualRemaining = balance.annual.remaining ?? 30;
                    const sickRemaining = balance.sick.remaining ?? 70;
                    const emergencyRemaining = balance.emergency.remaining ?? 6;
                    const serviceMonths = Math.max(0, ((new Date().getFullYear() - new Date(employee.joinDate).getFullYear()) * 12) + (new Date().getMonth() - new Date(employee.joinDate).getMonth()));
                    const hajjLabel = balance.hajj.everTaken ? "Taken" : serviceMonths >= 12 ? "Eligible" : "Ineligible";
                    return (
                      <tr key={employee.id} className="group border-b last:border-b-0">
                        <td className="py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span>{employee.name}</span>
                            <Button size="sm" variant="outline" className="opacity-0 transition group-hover:opacity-100" onClick={() => setHistoryEmployee(employee)}>View History</Button>
                          </div>
                        </td>
                        <td className="py-3">{employee.type}</td>
                        <td className={`py-3 ${annualRemaining <= 5 ? "bg-red-50 font-semibold text-red-700" : annualRemaining <= 15 ? "text-orange-600" : "text-green-600"}`}>{balance.annual.used} / {balance.annual.entitled}</td>
                        <td className={`py-3 ${sickRemaining <= 5 ? "font-semibold text-red-700" : sickRemaining <= 15 ? "text-orange-600" : "text-green-600"}`}>{balance.sick.used} / {balance.sick.entitled}</td>
                        <td className={`py-3 ${emergencyRemaining === 0 ? "font-semibold text-red-700" : emergencyRemaining <= 2 ? "text-orange-600" : "text-green-600"}`}>{balance.emergency.used} / {balance.emergency.entitled}</td>
                        <td className="py-3"><Badge variant={balance.hajj.everTaken ? "gray" : serviceMonths >= 12 ? "green" : "red"}>{hajjLabel}</Badge></td>
                        <td className="py-3"><Badge variant={balance.maternity.taken ? "gray" : "green"}>{balance.maternity.taken ? "Taken ✓" : "Available"}</Badge></td>
                        <td className="py-3"><Badge variant={balance.paternity.taken ? "gray" : "green"}>{balance.paternity.taken ? "Taken ✓" : "Available"}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(rejectState)} onOpenChange={(open) => !open && setRejectState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
            <DialogDescription>Reason for rejection (optional)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Reason for rejection (optional)" />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejectState(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject}>Confirm Reject</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyEmployee)} onOpenChange={(open) => !open && setHistoryEmployee(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{historyEmployee?.name} Leave History</DialogTitle>
            <DialogDescription>Timeline of all leave requests for this employee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {employeeHistory.length ? employeeHistory.map((request) => (
              <div key={request.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={leaveTypeBadgeTone[request.leaveType]}>{leaveTypeLabels[request.leaveType]}</Badge>
                  <Badge variant={getStatusBadge(request.status)}>{request.status}</Badge>
                </div>
                <p className="mt-2 text-sm">{formatDate(request.startDate)} → {formatDate(request.endDate)} · {request.workingDays} days</p>
                <p className="mt-1 text-sm text-slate-500">{request.reason || "No reason provided"}</p>
              </div>
            )) : <EmptyState title="No leave history" description="This employee has no leave requests yet." />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
