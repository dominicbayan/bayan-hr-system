"use client";

import type { VisaRecord } from "@/lib/types";

import { useFirestoreCollection } from "./use-firestore-collection";

export function useVisaRecords() {
  return useFirestoreCollection<VisaRecord>("visaRecords", [{ kind: "orderBy", field: "employeeName", direction: "asc" }]);
}
