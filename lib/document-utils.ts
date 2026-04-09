import type { Employee } from "@/lib/types";
import { daysBetween } from "@/lib/utils";

export type ExpiryStatus = "expired" | "30" | "90" | "valid" | "missing";

export function getDocumentStatus(date?: string): ExpiryStatus {
  const days = daysBetween(date);

  if (days === null) {
    return "missing";
  }
  if (days < 0) {
    return "expired";
  }
  if (days <= 30) {
    return "30";
  }
  if (days <= 90) {
    return "90";
  }
  return "valid";
}

export function getEmployeeDocumentStatuses(employee: Employee) {
  return [
    getDocumentStatus(employee.civilIdExpiry),
    getDocumentStatus(employee.passportExpiry),
    getDocumentStatus(employee.residencePermitExpiry),
    getDocumentStatus(employee.workPermitExpiry),
    getDocumentStatus(employee.laborCardExpiry),
  ];
}
