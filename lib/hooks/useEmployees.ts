"use client";

import type { Employee } from "@/lib/types";

import { useFirestoreCollection } from "./use-firestore-collection";

export function useEmployees() {
  return useFirestoreCollection<Employee>("employees", [{ kind: "orderBy", field: "employeeId", direction: "asc" }]);
}
