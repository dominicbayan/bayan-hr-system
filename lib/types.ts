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
  | "pilgrimage"
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
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: "pending" | "approved" | "rejected";
  reason: string;
  createdAt: string;
  approvedBy?: string;
  medicalCertificateRequired?: boolean;
}

export interface VisaRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  nationality: NationalityType;
  passportNumber: string;
  passportExpiry: string;
  visaType: string;
  visaNumber: string;
  issueDate: string;
  expiryDate: string;
  status: "active" | "expired" | "pending_renewal" | "cancelled";
  residencePermitExpiry?: string;
  workPermitExpiry?: string;
  laborCardExpiry?: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
  present: number;
  absent: number;
  leaveDays: number;
  otHours: number;
}

export interface OnboardingTask {
  label: string;
  completed: boolean;
}

export interface OnboardingRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  department: string;
  manager: string;
  progress: number;
  tasks: OnboardingTask[];
  notes?: string;
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
  | "attendance"
  | "onboarding"
  | "settings";
