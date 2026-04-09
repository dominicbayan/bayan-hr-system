"use client";

import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployees, useLeaveRequests, useVisaRecords } from "@/lib/hooks";
import { getDashboardMetrics } from "@/lib/hr-metrics";
import { getDocumentStatus } from "@/lib/document-utils";
import type { EmployeeType } from "@/lib/types";

const checklistItems = [
  "Leave Balances Updated",
  "ID Expiry Documents Reviewed",
  "Omanisation Report Filed",
  "New Joiners / Leavers Updated",
  "Attendance Records Closed",
];

const employeeTypes: EmployeeType[] = ["Management", "Omani", "Expat", "Other", "Household"];

export function DashboardOverview() {
  const { data: employees, loading: employeesLoading, error: employeesError } = useEmployees();
  const { data: leaveRequests, loading: leaveLoading, error: leaveError } = useLeaveRequests();
  const { data: visaRecords, loading: visaLoading } = useVisaRecords();
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const metrics = useMemo(() => getDashboardMetrics(employees, leaveRequests, visaRecords), [employees, leaveRequests, visaRecords]);

  if (employeesLoading || leaveLoading || visaLoading) {
    return <Spinner />;
  }

  if (employeesError || leaveError) {
    return <EmptyState title="Unable to load dashboard" description={employeesError ?? leaveError ?? "Please check Firebase permissions and config."} />;
  }

  if (!employees.length) {
    return <EmptyState title="No employees yet" description="Run the seed route once to populate the Bayan Investment House employee list." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-sm text-slate-500">Live HR overview for Bayan Investment House LLC.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total Headcount", String(metrics.headcount)],
          ["Omani Nationals", String(metrics.omanis)],
          ["Expats", String(metrics.expats)],
          ["Omanisation %", `${metrics.omanisation}%`],
          ["Employees On Leave", String(metrics.activeLeave)],
          ["Pending Leave Approvals", String(metrics.pendingApprovals)],
          ["Documents Expiring <= 30 days", String(metrics.expiring30)],
          ["Documents Expiring <= 90 days", String(metrics.expiring90)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-3">
              <p className="text-sm text-slate-500">{label}</p>
              <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Employee Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Headcount</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeTypes.map((type) => (
                    <tr key={type} className="border-b last:border-b-0">
                      <td className="py-3">{type}</td>
                      <td className="py-3">{employees.filter((employee) => employee.type === type).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HR Compliance Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {checklistItems.map((item) => (
              <label key={item} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <Checkbox
                  checked={checkedItems.includes(item)}
                  onCheckedChange={(checked) => {
                    setCheckedItems((current) =>
                      checked ? [...current, item] : current.filter((entry) => entry !== item),
                    );
                  }}
                />
                <span>{item}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Compliance Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {employees.slice(0, 6).map((employee) => {
              const passportState = getDocumentStatus(employee.passportExpiry);
              return (
                <div key={employee.id} className="rounded-xl border p-4">
                  <p className="font-medium">{employee.name}</p>
                  <p className="text-sm text-slate-500">{employee.employeeId} · {employee.position || "Position not set"}</p>
                  <p className="mt-2 text-sm">Passport status: {passportState}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
