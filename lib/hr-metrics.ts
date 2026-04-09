import type { AttendanceRecord, Employee, LeaveRequest, VisaRecord } from "@/lib/types";
import { getEmployeeDocumentStatuses } from "@/lib/document-utils";
import { getAnnualBalance } from "@/lib/leave-policy";
import { isDateActive } from "@/lib/utils";

export function getDashboardMetrics(
  employees: Employee[],
  leaveRequests: LeaveRequest[],
  _visaRecords: VisaRecord[] = [],
) {
  const omanis = employees.filter((employee) => employee.nationality === "Omani").length;
  const expats = employees.filter((employee) => employee.type === "Expat").length;
  const mainEmployees = employees.filter((employee) => employee.type !== "Household").length;
  const activeLeave = leaveRequests.filter(
    (request) => request.status === "approved" && isDateActive(request.startDate, request.endDate),
  ).length;
  const pendingApprovals = leaveRequests.filter((request) => request.status === "pending").length;

  const documentStatuses = employees.flatMap((employee) => getEmployeeDocumentStatuses(employee));
  const expiring30 = documentStatuses.filter((status) => status === "expired" || status === "30").length;
  const expiring90 = documentStatuses.filter((status) => status === "90").length + expiring30;

  return {
    headcount: employees.length,
    omanis,
    expats,
    omanisation: mainEmployees === 0 ? 0 : Math.round((omanis / mainEmployees) * 100),
    activeLeave,
    pendingApprovals,
    expiring30,
    expiring90,
  };
}

export function buildAttendanceSummary(records: AttendanceRecord[], employeeId: string) {
  return records
    .filter((record) => record.employeeId === employeeId)
    .reduce(
      (summary, record) => ({
        present: summary.present + record.present,
        absent: summary.absent + record.absent,
        leaveDays: summary.leaveDays + record.leaveDays,
        otHours: summary.otHours + record.otHours,
      }),
      { present: 0, absent: 0, leaveDays: 0, otHours: 0 },
    );
}

export function buildLeaveBalances(employees: Employee[], leaveRequests: LeaveRequest[]) {
  return employees.map((employee) => ({
    employee,
    ...getAnnualBalance(employee, leaveRequests),
  }));
}
