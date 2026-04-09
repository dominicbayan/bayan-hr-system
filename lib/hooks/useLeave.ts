"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "@/lib/firebase";
import { countCalendarDays, countWorkingDays } from "@/lib/omanCalendar";
import type { Employee, LeaveBalance, LeaveRequest, LeaveType } from "@/lib/types";

export function createDefaultLeaveBalance(employeeId: string, year: number): Omit<LeaveBalance, "id"> {
  return {
    employeeId,
    year,
    annual: { entitled: 30, used: 0, pending: 0, remaining: 30 },
    sick: { entitled: 70, used: 0, pending: 0, remaining: 70 },
    emergency: { entitled: 6, used: 0, pending: 0, remaining: 6 },
    maternity: { entitled: 50, used: 0, taken: false },
    paternity: { entitled: 7, used: 0, taken: false },
    bereavement: { entitled: 0, used: 0 },
    unpaid: { used: 0 },
    hajj: { entitled: 15, used: 0, everTaken: false },
  };
}

function sortRequests(requests: LeaveRequest[]) {
  return requests.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function getServiceMonths(joinDate: string) {
  const join = new Date(joinDate);
  const now = new Date();
  return (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth()) - (now.getDate() < join.getDate() ? 1 : 0);
}

export function getLeaveDays(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return {
    calendarDays: countCalendarDays(start, end),
    workingDays: countWorkingDays(start, end),
  };
}

function requestsForEmployeeYear(requests: LeaveRequest[], employeeId: string, year: number) {
  return requests.filter((request) => request.employeeId === employeeId && request.leaveYear === year);
}

function sumWorkingDays(requests: LeaveRequest[], leaveType: LeaveType, statuses: Array<LeaveRequest["status"]>) {
  return requests
    .filter((request) => request.leaveType === leaveType && statuses.includes(request.status))
    .reduce((sum, request) => sum + request.workingDays, 0);
}

export function useLeaveRequests() {
  const [state, setState] = useState<{ requests: LeaveRequest[]; loading: boolean; error: string | null }>({
    requests: [],
    loading: Boolean(db),
    error: db ? null : "Firebase is not configured.",
  });

  useEffect(() => {
    if (!db) {
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "leaveRequests"),
      (snapshot) => {
        const requests = snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as LeaveRequest);
        setState({ requests: sortRequests(requests), loading: false, error: null });
      },
      (error) => setState({ requests: [], loading: false, error: error.message }),
    );

    return unsubscribe;
  }, []);

  return state;
}

export function useLeaveBalance(employeeId: string, year: number) {
  const [state, setState] = useState<{ balance: LeaveBalance | null; loading: boolean; error: string | null }>({
    balance: employeeId ? null : null,
    loading: Boolean(employeeId) && Boolean(db),
    error: db ? null : "Firebase is not configured.",
  });

  useEffect(() => {
    if (!db || !employeeId) {
      return;
    }

    const balanceRef = doc(db, "leaveBalances", `${employeeId}_${year}`);
    const unsubscribe = onSnapshot(
      balanceRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ balance: { id: snapshot.id, ...createDefaultLeaveBalance(employeeId, year) }, loading: false, error: null });
          return;
        }
        setState({ balance: { id: snapshot.id, ...snapshot.data() } as LeaveBalance, loading: false, error: null });
      },
      (error) => setState({ balance: null, loading: false, error: error.message }),
    );

    return unsubscribe;
  }, [employeeId, year]);

  return state;
}

export function useAllLeaveBalances(year: number) {
  const [state, setState] = useState<{ balances: LeaveBalance[]; loading: boolean; error: string | null }>({
    balances: [],
    loading: Boolean(db),
    error: db ? null : "Firebase is not configured.",
  });

  useEffect(() => {
    if (!db) {
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, "leaveBalances"), where("year", "==", year)),
      (snapshot) => {
        setState({
          balances: snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as LeaveBalance),
          loading: false,
          error: null,
        });
      },
      (error) => setState({ balances: [], loading: false, error: error.message }),
    );

    return unsubscribe;
  }, [year]);

  return state;
}

async function ensureBalance(employeeId: string, year: number) {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  const balanceRef = doc(db, "leaveBalances", `${employeeId}_${year}`);
  await setDoc(balanceRef, createDefaultLeaveBalance(employeeId, year), { merge: true });
  return balanceRef;
}

async function getRequestById(requestId: string) {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  const requestRef = doc(db, "leaveRequests", requestId);
  const snapshot = await getDoc(requestRef);
  if (!snapshot.exists()) {
    throw new Error("Leave request not found.");
  }
  return { requestRef, request: { id: snapshot.id, ...snapshot.data() } as LeaveRequest };
}

async function patchBalanceForRequest(request: LeaveRequest, change: "submit" | "approve" | "reject" | "cancel") {
  const balanceRef = await ensureBalance(request.employeeId, request.leaveYear);
  const amount = request.workingDays;
  const updates: Record<string, unknown> = {};

  if (request.leaveType === "annual" || request.leaveType === "sick" || request.leaveType === "emergency") {
    const base = request.leaveType;
    if (change === "submit") {
      updates[`${base}.pending`] = increment(amount);
      updates[`${base}.remaining`] = increment(-amount);
    }
    if (change === "approve") {
      updates[`${base}.pending`] = increment(-amount);
      updates[`${base}.used`] = increment(amount);
    }
    if (change === "reject" || change === "cancel") {
      updates[`${base}.pending`] = increment(-amount);
      updates[`${base}.remaining`] = increment(amount);
    }
  }

  if (request.leaveType === "maternity" && change === "approve") {
    updates["maternity.used"] = increment(amount);
    updates["maternity.taken"] = true;
  }

  if (request.leaveType === "paternity" && change === "approve") {
    updates["paternity.used"] = increment(amount);
    updates["paternity.taken"] = true;
  }

  if (request.leaveType === "hajj" && change === "approve") {
    updates["hajj.used"] = increment(amount);
    updates["hajj.everTaken"] = true;
  }

  if (request.leaveType === "bereavement" && change === "approve") {
    updates["bereavement.used"] = increment(amount);
  }

  if (request.leaveType === "unpaid" && change === "approve") {
    updates["unpaid.used"] = increment(amount);
  }

  if (Object.keys(updates).length) {
    await updateDoc(balanceRef, updates);
  }
}

export function useLeaveActions() {
  const submitLeaveRequest = async (data: Omit<LeaveRequest, "id">) => {
    if (!db) {
      throw new Error("Firebase is not configured.");
    }
    const requestRef = await addDoc(collection(db, "leaveRequests"), data);
    await patchBalanceForRequest({ id: requestRef.id, ...data }, "submit");
    return requestRef;
  };

  const approveLeave = async (requestId: string, approvedBy: string) => {
    const { requestRef, request } = await getRequestById(requestId);
    await updateDoc(requestRef, {
      status: "approved",
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
    await patchBalanceForRequest(request, "approve");
  };

  const rejectLeave = async (requestId: string, reason: string) => {
    const { requestRef, request } = await getRequestById(requestId);
    await updateDoc(requestRef, {
      status: "rejected",
      rejectedReason: reason,
    });
    await patchBalanceForRequest(request, "reject");
  };

  const cancelLeave = async (requestId: string) => {
    const { requestRef, request } = await getRequestById(requestId);
    await updateDoc(requestRef, {
      status: "cancelled",
    });
    await patchBalanceForRequest(request, "cancel");
  };

  return { submitLeaveRequest, approveLeave, rejectLeave, cancelLeave };
}

export function validateLeaveRequest(params: {
  employee: Employee | undefined;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  requests: LeaveRequest[];
  balance: LeaveBalance | null;
  year: number;
  medicalCert: boolean;
  birthDate?: string;
  childReference?: string;
  bereavementRelation?: "spouse" | "parent" | "child" | "sibling";
  hajjConfirmation?: boolean;
}) {
  const {
    employee,
    leaveType,
    startDate,
    endDate,
    requests,
    balance,
    year,
    medicalCert,
    birthDate,
    childReference,
    bereavementRelation,
    hajjConfirmation,
  } = params;

  if (!employee) {
    return { valid: false, error: "Please select an employee.", calendarDays: 0, workingDays: 0 };
  }
  if (!startDate || !endDate) {
    return { valid: false, error: "Start and end date are required.", calendarDays: 0, workingDays: 0 };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    return { valid: false, error: "To Date must be on or after From Date.", calendarDays: 0, workingDays: 0 };
  }

  const { calendarDays, workingDays } = getLeaveDays(startDate, endDate);
  const serviceMonths = getServiceMonths(employee.joinDate);
  const employeeRequests = requests.filter((request) => request.employeeId === employee.id);
  const currentYearRequests = requestsForEmployeeYear(requests, employee.id, year);
  const effectiveBalance = balance ?? { id: `${employee.id}_${year}`, ...createDefaultLeaveBalance(employee.id, year) };

  if (leaveType === "annual") {
    if (serviceMonths < 6) {
      return { valid: false, error: "Annual leave is only available after 6 months of continuous service.", calendarDays, workingDays };
    }
    if ((effectiveBalance.annual.remaining ?? 30) < workingDays) {
      return { valid: false, error: `Requested ${workingDays} days but only ${effectiveBalance.annual.remaining ?? 30} annual days remain.`, calendarDays, workingDays };
    }
  }

  if (leaveType === "sick") {
    const used = sumWorkingDays(currentYearRequests, "sick", ["pending", "approved"]);
    if (!medicalCert) {
      return { valid: false, error: "Medical certificate is mandatory for sick leave.", calendarDays, workingDays };
    }
    if (used + workingDays > 70) {
      return { valid: false, error: "Sick leave cannot exceed 70 working days in a leave year.", calendarDays, workingDays };
    }
  }

  if (leaveType === "maternity") {
    if (employee.gender !== "female") {
      return { valid: false, error: employee.gender ? "Maternity leave is only available to female employees." : "Employee gender must be set to validate maternity leave.", calendarDays, workingDays };
    }
    const alreadyTaken = currentYearRequests.some((request) => request.leaveType === "maternity" && request.status !== "rejected" && request.status !== "cancelled");
    if (alreadyTaken) {
      return { valid: false, error: "Maternity leave has already been used in this leave year.", calendarDays, workingDays };
    }
    if (!birthDate) {
      return { valid: false, error: "Expected or actual birth date is required for maternity leave.", calendarDays, workingDays };
    }
  }

  if (leaveType === "paternity") {
    if (employee.gender !== "male") {
      return { valid: false, error: employee.gender ? "Paternity leave is only available to male employees." : "Employee gender must be set to validate paternity leave.", calendarDays, workingDays };
    }
    if (!birthDate || !childReference?.trim()) {
      return { valid: false, error: "Birth date and child reference are required for paternity leave.", calendarDays, workingDays };
    }
    const birth = new Date(birthDate);
    const diffDays = Math.floor((start.getTime() - birth.getTime()) / 86400000);
    if (diffDays < 0 || diffDays > 7) {
      return { valid: false, error: "Paternity leave must be taken within 7 days of birth.", calendarDays, workingDays };
    }
    const alreadyTaken = employeeRequests.some(
      (request) => request.leaveType === "paternity" && request.childReference === childReference.trim() && request.status !== "rejected" && request.status !== "cancelled",
    );
    if (alreadyTaken) {
      return { valid: false, error: "Paternity leave has already been taken for this child.", calendarDays, workingDays };
    }
  }

  if (leaveType === "hajj") {
    if (employee.religion !== "muslim") {
      return { valid: false, error: employee.religion ? "Hajj leave is only available to Muslim employees." : "Employee religion must be set to validate Hajj leave.", calendarDays, workingDays };
    }
    if (serviceMonths < 12) {
      return { valid: false, error: "Hajj leave requires at least 1 year of continuous service.", calendarDays, workingDays };
    }
    if (!hajjConfirmation) {
      return { valid: false, error: "Hajj confirmation is required before submission.", calendarDays, workingDays };
    }
    const alreadyTaken = employeeRequests.some((request) => request.leaveType === "hajj" && request.status === "approved");
    if (alreadyTaken || effectiveBalance.hajj.everTaken) {
      return { valid: false, error: "Hajj leave may only be taken once during employment.", calendarDays, workingDays };
    }
  }

  if (leaveType === "emergency") {
    const used = sumWorkingDays(currentYearRequests, "emergency", ["pending", "approved"]);
    if (used + workingDays > 6) {
      return { valid: false, error: "Emergency leave cannot exceed 6 working days in a leave year.", calendarDays, workingDays };
    }
  }

  if (leaveType === "bereavement" && !bereavementRelation) {
    return { valid: false, error: "Relationship to deceased is required for bereavement leave.", calendarDays, workingDays };
  }

  return { valid: true, error: null, calendarDays, workingDays };
}
