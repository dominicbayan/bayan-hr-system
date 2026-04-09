"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { createDocument, updateDocument, useEmployees, useLeaveRequests } from "@/lib/hooks";
import { buildLeaveBalances } from "@/lib/hr-metrics";
import { leaveTypeLabels } from "@/lib/leave-policy";
import type { LeaveRequest } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function LeaveManagement() {
  const { data: employees, loading: employeesLoading, error: employeesError } = useEmployees();
  const { data: leaveRequests, loading: leaveLoading, error: leaveError } = useLeaveRequests();
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"requests" | "balances">("requests");

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesEmployee = employeeFilter === "all" || request.employeeId === employeeFilter;
      return matchesStatus && matchesEmployee;
    });
  }, [employeeFilter, leaveRequests, statusFilter]);

  const balances = useMemo(() => buildLeaveBalances(employees, leaveRequests), [employees, leaveRequests]);

  async function updateStatus(request: LeaveRequest, status: "approved" | "rejected") {
    try {
      await updateDocument<LeaveRequest>("leaveRequests", request.id, {
        status,
        approvedBy: "HR Admin",
      });
      toast.success(`Leave request ${status}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update leave request.";
      toast.error(message);
    }
  }

  if (employeesLoading || leaveLoading) return <Spinner />;
  if (employeesError || leaveError) return <EmptyState title="Unable to load leave data" description={employeesError ?? leaveError ?? "Please check Firebase access."} />;
  if (!employees.length) return <EmptyState title="No employees available" description="Seed employees before using leave management." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Leave Management</h2>
        <p className="text-sm text-slate-500">Aligned with Oman Labour Law requirements for leave requests and balances.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6 text-sm text-slate-600 dark:text-slate-300">
          <span>Annual Leave: 30 days/year after 1 year service</span>
          <span>Sick Leave: max 10 weeks/year with medical certificate</span>
          <span>Maternity Leave: 50 days paid</span>
          <span>Paternity Leave: 7 days paid</span>
          <span>Pilgrimage Leave: 15 days once per employment</span>
          <span>Bereavement Leave: 3 days</span>
          <span>Emergency Leave: 6 days</span>
          <span>Unpaid Leave: by approval</span>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant={activeTab === "requests" ? "default" : "outline"} onClick={() => setActiveTab("requests")}>Leave Requests</Button>
        <Button variant={activeTab === "balances" ? "default" : "outline"} onClick={() => setActiveTab("balances")}>Leave Balances</Button>
      </div>

      {activeTab === "requests" ? (
        <Card>
          <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
                <option value="all">All employees</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </div>

            {filteredRequests.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="pb-3">Employee</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Dates</th>
                      <th className="pb-3">Days</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request) => (
                      <tr className="border-b last:border-b-0" key={request.id}>
                        <td className="py-3">
                          <p className="font-medium">{request.employeeName}</p>
                          <p className="text-xs text-slate-500">{request.reason}</p>
                        </td>
                        <td className="py-3">{leaveTypeLabels[request.type]}</td>
                        <td className="py-3">{formatDate(request.startDate)} to {formatDate(request.endDate)}</td>
                        <td className="py-3">{request.days}</td>
                        <td className="py-3"><Badge variant={request.status === "approved" ? "green" : request.status === "pending" ? "yellow" : "red"}>{request.status}</Badge></td>
                        <td className="py-3">
                          {request.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateStatus(request, "approved")}>Approve</Button>
                              <Button size="sm" variant="destructive" onClick={() => updateStatus(request, "rejected")}>Reject</Button>
                            </div>
                          ) : (
                            <span className="text-slate-400">No action</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No leave requests found" description="Submit a leave request to start the workflow." />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Leave Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Annual Entitlement</th>
                    <th className="pb-3">Used</th>
                    <th className="pb-3">Pending</th>
                    <th className="pb-3">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((balance) => {
                    const variant = balance.remaining <= 5 ? "red" : balance.remaining <= 10 ? "orange" : "green";
                    return (
                      <tr className="border-b last:border-b-0" key={balance.employee.id}>
                        <td className="py-3">{balance.employee.name}</td>
                        <td className="py-3">{balance.entitlement}</td>
                        <td className="py-3">{balance.used}</td>
                        <td className="py-3">{balance.pending}</td>
                        <td className="py-3"><Badge variant={variant}>{balance.remaining}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
