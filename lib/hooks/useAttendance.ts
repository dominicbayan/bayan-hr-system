"use client";

import type { AttendanceRecord } from "@/lib/types";

import { useFirestoreCollection } from "./use-firestore-collection";

export function useAttendance(year: number) {
  return useFirestoreCollection<AttendanceRecord>("attendance", [
    { kind: "where", field: "year", operator: "==", value: year },
    { kind: "orderBy", field: "employeeName", direction: "asc" },
    { kind: "orderBy", field: "month", direction: "asc" },
  ]);
}
