export type EmployeeType = "Management" | "Omani" | "Expat" | "Other" | "Household";
export type NationalityType = "Omani" | "Non-Omani";
export type EmployeeStatus = "active" | "on_leave" | "terminated";
export type LeaveType =
  | "annual"
  | "sick"
  | "maternity"
  | "paternity"
  | "emergency"
  | "unpaid"
  | "hajj"
  | "bereavement";

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  type: EmployeeType;
  nationality: NationalityType;
  position: string;
  department: string;
  joinDate: string;
  status: EmployeeStatus;
  gender?: "male" | "female";
  religion?: "muslim" | "non_muslim";
  civilId?: string;
  civilIdExpiry?: string;
  passportNumber?: string;
  passportExpiry?: string;
  residencePermitNumber?: string;
  residencePermitExpiry?: string;
  workPermitNumber?: string;
  workPermitExpiry?: string;
  laborCardNumber?: string;
  laborCardExpiry?: string;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeType: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  calendarDays: number;
  workingDays: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string;
  medicalCert: boolean;
  rejectedReason: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  leaveYear: number;
  childReference?: string;
  birthDate?: string;
  bereavementRelation?: "spouse" | "parent" | "child" | "sibling";
  hajjConfirmation?: boolean;
}

export interface LeaveBalanceBucket {
  entitled: number;
  used: number;
  pending?: number;
  remaining?: number;
  taken?: boolean;
  everTaken?: boolean;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  year: number;
  annual: LeaveBalanceBucket;
  sick: LeaveBalanceBucket;
  emergency: LeaveBalanceBucket;
  maternity: LeaveBalanceBucket;
  paternity: LeaveBalanceBucket;
  bereavement: LeaveBalanceBucket;
  unpaid: { used: number };
  hajj: LeaveBalanceBucket;
}

export type DocumentCategory =
  | "civil_id"
  | "passport"
  | "residence_permit"
  | "work_permit"
  | "labor_card"
  | "visa"
  | "medical_fitness"
  | "police_clearance"
  | "education_cert"
  | "employment_contract"
  | "other";

export type EmployeeDocumentStatus = "valid" | "expired" | "expiring_soon" | "pending_upload";

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  category: DocumentCategory;
  name: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
  issuingCountry: string;
  notes: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  status: EmployeeDocumentStatus;
}

export interface HookState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

export type HrSection =
  | "dashboard"
  | "employees"
  | "documents"
  | "leave-management"
  | "leave-request"
  | "settings";
