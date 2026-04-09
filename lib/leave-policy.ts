import type { Employee, LeaveRequest, LeaveType } from "@/lib/types";
import { calculateDateRangeDays } from "@/lib/utils";

const annualEntitlement = 30;

export const leaveTypeLabels: Record<LeaveType, string> = {
  annual: "Annual Leave",
  sick: "Sick Leave",
  maternity: "Maternity Leave",
  paternity: "Paternity Leave",
  emergency: "Emergency Leave",
  unpaid: "Unpaid Leave",
  pilgrimage: "Hajj / Pilgrimage Leave",
  bereavement: "Bereavement Leave",
};

export function getLeaveLimit(type: LeaveType) {
  switch (type) {
    case "annual":
      return 30;
    case "sick":
      return 70;
    case "maternity":
      return 50;
    case "paternity":
      return 7;
    case "emergency":
      return 6;
    case "pilgrimage":
      return 15;
    case "bereavement":
      return 3;
    case "unpaid":
      return Number.POSITIVE_INFINITY;
  }
}

export function getAnnualBalance(employee: Employee, leaveRequests: LeaveRequest[]) {
  const employeeRequests = leaveRequests.filter((request) => request.employeeId === employee.id && request.type === "annual");
  const used = employeeRequests.filter((request) => request.status === "approved").reduce((sum, request) => sum + request.days, 0);
  const pending = employeeRequests.filter((request) => request.status === "pending").reduce((sum, request) => sum + request.days, 0);
  const remaining = Math.max(annualEntitlement - used - pending, 0);

  return { entitlement: annualEntitlement, used, pending, remaining };
}

export function validateLeaveRequest(params: {
  employee: Employee | undefined;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  leaveRequests: LeaveRequest[];
  medicalCertificateRequired: boolean;
}) {
  const { employee, leaveType, startDate, endDate, days, leaveRequests, medicalCertificateRequired } = params;

  if (!employee) {
    return "Please select an employee.";
  }

  if (!startDate || !endDate) {
    return "Start and end date are required.";
  }

  if (days !== calculateDateRangeDays(startDate, endDate) || days <= 0) {
    return "Leave days must match the selected dates.";
  }

  const limit = getLeaveLimit(leaveType);
  const approvedDays = leaveRequests
    .filter((request) => request.employeeId === employee.id && request.type === leaveType && request.status !== "rejected")
    .reduce((sum, request) => sum + request.days, 0);

  if (leaveType === "annual") {
    const serviceDays = calculateDateRangeDays(employee.joinDate, new Date().toISOString().slice(0, 10));
    if (serviceDays < 365) {
      return "Annual leave is available after one year of service.";
    }
  }

  if (leaveType === "pilgrimage" && approvedDays > 0) {
    return "Pilgrimage leave can only be granted once per employment.";
  }

  if (leaveType === "sick" && !medicalCertificateRequired) {
    return "Medical certificate confirmation is required for sick leave.";
  }

  if (approvedDays + days > limit) {
    return `This request exceeds the allowed ${leaveTypeLabels[leaveType].toLowerCase()} limit.`;
  }

  return null;
}
