import type {
  DocumentCategory,
  Employee,
  EmployeeDocument,
  EmployeeDocumentStatus,
} from "@/lib/types";
import { daysBetween } from "@/lib/utils";

export const categoryLabels: Record<DocumentCategory, string> = {
  civil_id: "Civil ID",
  passport: "Passport",
  residence_permit: "Residence Permit",
  work_permit: "Work Permit",
  labor_card: "Labor Card",
  visa: "Visa",
  medical_fitness: "Medical Fitness",
  police_clearance: "Police Clearance",
  education_cert: "Education Certificate",
  employment_contract: "Employment Contract",
  other: "Other Document",
};

export const omaniCategories: DocumentCategory[] = [
  "civil_id",
  "passport",
  "employment_contract",
  "education_cert",
  "other",
];

export const expatCategories: DocumentCategory[] = [
  "passport",
  "residence_permit",
  "work_permit",
  "labor_card",
  "visa",
  "medical_fitness",
  "police_clearance",
  "employment_contract",
  "education_cert",
  "other",
];

export function getCategoriesForEmployee(employee: Pick<Employee, "type" | "nationality">) {
  return employee.type === "Expat" || employee.nationality === "Non-Omani" ? expatCategories : omaniCategories;
}

export function getDocumentStatusFromExpiry(expiryDate?: string): EmployeeDocumentStatus {
  const days = daysBetween(expiryDate);

  if (days === null) {
    return "pending_upload";
  }
  if (days < 0) {
    return "expired";
  }
  if (days <= 90) {
    return "expiring_soon";
  }
  return "valid";
}

export function getStatusMeta(status: EmployeeDocumentStatus, expiryDate?: string) {
  const days = daysBetween(expiryDate);

  if (status === "expired") {
    return { tone: "red" as const, label: "Expired", rank: 4 };
  }
  if (status === "expiring_soon") {
    if (days !== null && days <= 30) {
      return { tone: "orange" as const, label: `${days} days left`, rank: 3 };
    }
    return { tone: "yellow" as const, label: days === null ? "Expiring soon" : `${days} days left`, rank: 2 };
  }
  if (status === "valid") {
    return { tone: "green" as const, label: days === null ? "Valid" : `${days} days left`, rank: 1 };
  }
  return { tone: "gray" as const, label: "Pending upload", rank: 0 };
}

export function getDocumentForCategory(documents: EmployeeDocument[], category: DocumentCategory) {
  return documents.find((document) => document.category === category) ?? null;
}

export function getEmployeeDocumentHealth(employee: Employee, documents: EmployeeDocument[]) {
  const requiredCategories = getCategoriesForEmployee(employee);
  const relevantDocuments = requiredCategories
    .map((category) => getDocumentForCategory(documents, category))
    .filter((document): document is EmployeeDocument => Boolean(document));

  if (!relevantDocuments.length) {
    return { tone: "gray" as const, label: "No documents", filterKey: "none" as const };
  }

  const topStatus = relevantDocuments
    .map((document) => getStatusMeta(document.status, document.expiryDate))
    .sort((left, right) => right.rank - left.rank)[0];

  if (topStatus.rank >= 4) {
    return { tone: "red" as const, label: "Expired documents", filterKey: "expired" as const };
  }
  if (topStatus.rank >= 3) {
    return { tone: "orange" as const, label: "Expiring <= 30 days", filterKey: "30" as const };
  }
  if (topStatus.rank >= 2) {
    return { tone: "yellow" as const, label: "Expiring <= 90 days", filterKey: "90" as const };
  }
  return { tone: "green" as const, label: "All valid", filterKey: "valid" as const };
}

export function hasMissingRequiredDocuments(employee: Employee, documents: EmployeeDocument[]) {
  return getCategoriesForEmployee(employee).some((category) => !getDocumentForCategory(documents, category));
}

export function buildDocumentUploadPath(employeeId: string, category: DocumentCategory, fileName: string) {
  const timestamp = Date.now();
  const safeFileName = fileName.replace(/\s+/g, "-");
  return `documents/${employeeId}/${category}/${timestamp}_${safeFileName}`;
}
