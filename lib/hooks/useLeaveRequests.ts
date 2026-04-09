"use client";

import type { LeaveRequest } from "@/lib/types";

import { useFirestoreCollection } from "./use-firestore-collection";

export function useLeaveRequests() {
  return useFirestoreCollection<LeaveRequest>("leaveRequests", [{ kind: "orderBy", field: "createdAt", direction: "desc" }]);
}
