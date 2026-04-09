"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { createDocument, updateDocument, useAttendance, useEmployees } from "@/lib/hooks";
import { buildAttendanceSummary } from "@/lib/hr-metrics";
import type { AttendanceRecord } from "@/lib/types";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const workingDaysReference = [23, 20, 26, 22, 21, 22, 23, 21, 22, 23, 21, 22];

export function AttendanceSection() {
  const year = 2026;
  const { data: employees, loading: employeesLoading, error: employeesError } = useEmployees();
  const { data: attendance, loading: attendanceLoading, error: attendanceError } = useAttendance(year);
  const [selectedMonth, setSelectedMonth] = useState(3);

  useEffect(() => {
    if (!employees.length || attendanceLoading) return;
    const missingMarchEmployees = employees.filter(
      (employee) => !attendance.some((record) => record.employeeId === employee.id && record.month === 3),
    );

    if (!missingMarchEmployees.length) return;

    Promise.all(
      missingMarchEmployees.map((employee) =>
        createDocument("attendance", {
          employeeId: employee.id,
          employeeName: employee.name,
          year,
          month: 3,
          present: 26,
          absent: 0,
          leaveDays: 0,
          otHours: 0,
        }),
      ),
    ).catch(() => {
      toast.error("Unable to pre-fill March 2026 attendance.");
    });
  }, [attendance, attendanceLoading, employees]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach((record) => {
      map.set(`${record.employeeId}-${record.month}`, record);
    });
    return map;
  }, [attendance]);

  async function saveValue(employeeId: string, employeeName: string, field: "present" | "absent" | "leaveDays" | "otHours", value: number) {
    const existing = attendanceMap.get(`${employeeId}-${selectedMonth}`);
    try {
      if (existing) {
        await updateDocument<AttendanceRecord>("attendance", existing.id, { [field]: value });
      } else {
        await createDocument("attendance", {
          employeeId,
          employeeName,
          year,
          month: selectedMonth,
          present: field === "present" ? value : 0,
          absent: field === "absent" ? value : 0,
          leaveDays: field === "leaveDays" ? value : 0,
          otHours: field === "otHours" ? value : 0,
        });
      }
      toast.success("Attendance saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save attendance.";
      toast.error(message);
    }
  }

  if (employeesLoading || attendanceLoading) return <Spinner />;
  if (employeesError || attendanceError) return <EmptyState title="Unable to load attendance" description={employeesError ?? attendanceError ?? "Please check Firebase access."} />;
  if (!employees.length) return <EmptyState title="No employees available" description="Seed employees before recording attendance." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Attendance</h2>
        <p className="text-sm text-slate-500">Yearly attendance tracker for 2026 with auto-save on blur.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Month Selector</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {months.map((month, index) => (
              <button
                key={month}
                type="button"
                className={`rounded-lg px-3 py-2 text-sm ${selectedMonth === index + 1 ? "bg-teal-600 text-white" : "border"}`}
                onClick={() => setSelectedMonth(index + 1)}
              >
                {month}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">Working days reference for {months[selectedMonth - 1]} 2026: {workingDaysReference[selectedMonth - 1]}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-3">Employee</th>
                  <th className="pb-3">Present</th>
                  <th className="pb-3">Absent</th>
                  <th className="pb-3">Leave</th>
                  <th className="pb-3">OT Hours</th>
                  <th className="pb-3">YTD Summary</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const selectedRecord = attendanceMap.get(`${employee.id}-${selectedMonth}`);
                  const summary = buildAttendanceSummary(attendance, employee.id);
                  const rowTone = summary.absent > 5 ? "bg-red-50 dark:bg-red-950/20" : summary.absent >= 3 ? "bg-orange-50 dark:bg-orange-950/20" : "";
                  return (
                    <tr key={employee.id} className={`border-b last:border-b-0 ${rowTone}`}>
                      <td className="py-3">
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.employeeId}</p>
                      </td>
                      {(["present", "absent", "leaveDays", "otHours"] as const).map((field) => (
                        <td key={field} className="py-3">
                          <input
                            type="number"
                            step={field === "otHours" ? "0.5" : "1"}
                            className="h-10 w-24 rounded-lg border bg-transparent px-3"
                            defaultValue={selectedRecord?.[field] ?? 0}
                            onBlur={(event) => saveValue(employee.id, employee.name, field, Number(event.target.value) || 0)}
                          />
                        </td>
                      ))}
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="green">P {summary.present}</Badge>
                          <Badge variant={summary.absent > 5 ? "red" : summary.absent >= 3 ? "orange" : "green"}>A {summary.absent}</Badge>
                          <Badge variant="yellow">L {summary.leaveDays}</Badge>
                          <Badge variant="default">OT {summary.otHours}</Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
