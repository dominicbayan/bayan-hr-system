import type { LeaveBalance, LeaveRequest, LeaveType } from "@/lib/types";

export const leaveTypeLabels: Record<LeaveType, string> = {
  annual: "Annual Leave",
  sick: "Sick Leave",
  maternity: "Maternity Leave",
  paternity: "Paternity Leave",
  hajj: "Hajj Leave",
  emergency: "Emergency Leave",
  bereavement: "Bereavement Leave",
  unpaid: "Unpaid Leave",
};

export const leaveTypeDescriptions: Record<LeaveType, string> = {
  annual: "30 days/year after 6 months of service (Art. 61)",
  sick: "Up to 10 weeks/year with medical certificate (Art. 66)",
  maternity: "50 calendar days fully paid (Art. 83)",
  paternity: "7 calendar days fully paid within 7 days of birth",
  hajj: "15 calendar days once per employment after 1 year (Art. 65)",
  emergency: "6 calendar days/year for urgent circumstances (Art. 67)",
  bereavement: "3 calendar days for first-degree relatives (Art. 67)",
  unpaid: "Employer discretion, explicit approval required",
};

export const leaveTypeBadgeTone: Record<LeaveType, "default" | "green" | "yellow" | "orange" | "red"> = {
  annual: "default",
  sick: "yellow",
  maternity: "red",
  paternity: "green",
  hajj: "orange",
  emergency: "orange",
  bereavement: "yellow",
  unpaid: "red",
};

export function getBalanceSummary(balance: LeaveBalance | null) {
  if (!balance) {
    return {
      annual: "30/30",
      sick: "70/70",
      emergency: "6/6",
    };
  }

  return {
    annual: `${balance.annual.remaining ?? 30}/${balance.annual.entitled}`,
    sick: `${(balance.sick.remaining ?? 70)}/${balance.sick.entitled}`,
    emergency: `${(balance.emergency.remaining ?? 6)}/${balance.emergency.entitled}`,
  };
}

export function getLeaveBucket(balance: LeaveBalance, leaveType: LeaveType) {
  if (leaveType === "unpaid") {
    return { used: balance.unpaid.used, entitled: 0, remaining: 0, pending: 0 };
  }
  if (leaveType === "hajj") {
    return { used: balance.hajj.used, entitled: balance.hajj.entitled, remaining: balance.hajj.entitled, pending: 0 };
  }
  if (leaveType === "maternity") {
    return { used: balance.maternity.used, entitled: balance.maternity.entitled, remaining: balance.maternity.entitled - balance.maternity.used, pending: 0 };
  }
  if (leaveType === "paternity") {
    return { used: balance.paternity.used, entitled: balance.paternity.entitled, remaining: balance.paternity.entitled - balance.paternity.used, pending: 0 };
  }
  if (leaveType === "bereavement") {
    return { used: balance.bereavement.used, entitled: 0, remaining: 0, pending: 0 };
  }
  return balance[leaveType];
}

export function requestCanBeCancelled(request: LeaveRequest) {
  return request.status === "approved" && new Date(request.startDate) > new Date();
}
