import type { Employee, EmployeeDocument, LeaveRequest } from "@/lib/types";
import { getEmployeeDocumentHealth } from "@/lib/document-center";
import { isDateActive } from "@/lib/utils";

export function getDashboardMetrics(
  employees: Employee[],
  leaveRequests: LeaveRequest[],
  documents: EmployeeDocument[] = [],
) {
  const omanis = employees.filter((employee) => employee.nationality === "Omani").length;
  const expats = employees.filter((employee) => employee.type === "Expat").length;
  const mainEmployees = employees.filter((employee) => employee.type !== "Household").length;
  const activeLeave = leaveRequests.filter(
    (request) => request.status === "approved" && isDateActive(request.startDate, request.endDate),
  ).length;
  const pendingApprovals = leaveRequests.filter((request) => request.status === "pending").length;

  const latestDocumentsByEmployee = new Map<string, Map<string, EmployeeDocument>>();
  documents.forEach((document) => {
    const employeeMap = latestDocumentsByEmployee.get(document.employeeId) ?? new Map<string, EmployeeDocument>();
    const current = employeeMap.get(document.category);
    if (!current || current.uploadedAt < document.uploadedAt) {
      employeeMap.set(document.category, document);
    }
    latestDocumentsByEmployee.set(document.employeeId, employeeMap);
  });

  const latestDocuments = Array.from(latestDocumentsByEmployee.values()).flatMap((employeeMap) =>
    Array.from(employeeMap.values()),
  );
  const expiring30 = latestDocuments.filter(
    (document) => document.status === "expired" || (document.status === "expiring_soon" && document.expiryDate),
  ).filter((document) => {
    const remaining = new Date(document.expiryDate).getTime() - new Date().getTime();
    return remaining <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const expiring90 = latestDocuments.filter((document) => {
    const remaining = new Date(document.expiryDate).getTime() - new Date().getTime();
    return remaining <= 90 * 24 * 60 * 60 * 1000;
  }).length;

  const employeeHealth = new Map(
    employees.map((employee) => [
      employee.id,
      getEmployeeDocumentHealth(employee, Array.from(latestDocumentsByEmployee.get(employee.id)?.values() ?? [])),
    ]),
  );

  return {
    headcount: employees.length,
    omanis,
    expats,
    omanisation: mainEmployees === 0 ? 0 : Math.round((omanis / mainEmployees) * 100),
    activeLeave,
    pendingApprovals,
    expiring30,
    expiring90,
    employeeHealth,
  };
}
