"use client";

import type { OnboardingRecord } from "@/lib/types";

import { useFirestoreCollection } from "./use-firestore-collection";

export function useOnboarding() {
  return useFirestoreCollection<OnboardingRecord>("onboarding", [{ kind: "orderBy", field: "employeeName", direction: "asc" }]);
}
