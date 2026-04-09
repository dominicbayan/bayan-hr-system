"use client";

import {
  collection,
  collectionGroup,
  onSnapshot,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { db, firebaseConfigured } from "@/lib/firebase";
import type { EmployeeDocument, HookState } from "@/lib/types";

const emptyState: HookState<EmployeeDocument> = {
  data: [],
  loading: false,
  error: null,
};

export function useEmployeeDocuments(employeeId: string | null) {
  const [state, setState] = useState<HookState<EmployeeDocument>>({
    data: [],
    loading: Boolean(employeeId) && firebaseConfigured && Boolean(db),
    error: firebaseConfigured && db ? null : "Firebase is not configured.",
  });

  useEffect(() => {
    if (!employeeId) {
      return;
    }

    if (!db || !firebaseConfigured) {
      return;
    }

    const documentsRef = collection(db, "employees", employeeId, "documents");
    const documentsQuery = query(documentsRef);

    const unsubscribe = onSnapshot(
      documentsQuery,
      (snapshot) => {
        setState({
          data: snapshot.docs
            .map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as EmployeeDocument)
            .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)),
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState({ data: [], loading: false, error: error.message });
      },
    );

    return unsubscribe;
  }, [employeeId]);

  return employeeId ? state : emptyState;
}

export function useAllEmployeeDocuments() {
  const [state, setState] = useState<HookState<EmployeeDocument>>({
    data: [],
    loading: firebaseConfigured && Boolean(db),
    error: firebaseConfigured && db ? null : "Firebase is not configured.",
  });

  useEffect(() => {
    if (!db || !firebaseConfigured) {
      return;
    }

    const documentsQuery = query(collectionGroup(db, "documents"));
    const unsubscribe = onSnapshot(
      documentsQuery,
      (snapshot) => {
        setState({
          data: snapshot.docs
            .map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as EmployeeDocument)
            .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)),
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState({ data: [], loading: false, error: error.message });
      },
    );

    return unsubscribe;
  }, []);

  return state;
}
