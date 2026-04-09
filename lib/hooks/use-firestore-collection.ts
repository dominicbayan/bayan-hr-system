"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import { db, firebaseConfigured } from "@/lib/firebase";
import type { HookState } from "@/lib/types";

type SupportedConstraint =
  | { kind: "orderBy"; field: string; direction?: "asc" | "desc" }
  | { kind: "where"; field: string; operator: "==" | "<=" | ">="; value: string | number };

export function useFirestoreCollection<T>(collectionName: string, constraints: SupportedConstraint[] = []) {
  const [state, setState] = useState<HookState<T>>({
    data: [],
    loading: firebaseConfigured && Boolean(db),
    error: firebaseConfigured && db ? null : "Firebase is not configured.",
  });
  const stableKey = useMemo(() => JSON.stringify(constraints), [constraints]);

  useEffect(() => {
    if (!firebaseConfigured || !db) {
      return;
    }

    const collectionRef = collection(db, collectionName);
    const queryConstraints = constraints.map((constraint) => {
      if (constraint.kind === "orderBy") {
        return orderBy(constraint.field, constraint.direction ?? "asc");
      }

      return where(constraint.field, constraint.operator, constraint.value);
    });

    const snapshotQuery = queryConstraints.length ? query(collectionRef, ...queryConstraints) : query(collectionRef);

    const unsubscribe = onSnapshot(
      snapshotQuery,
      (snapshot) => {
        setState({
          data: snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as T),
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState({ data: [], loading: false, error: error.message });
      },
    );

    return unsubscribe;
  }, [collectionName, stableKey, constraints]);

  return state;
}

export async function createDocument<T extends object>(collectionName: string, payload: T) {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  return addDoc(collection(db, collectionName), payload);
}

export async function updateDocument<T extends object>(collectionName: string, id: string, payload: Partial<T>) {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  return updateDoc(doc(db, collectionName, id), payload as Record<string, unknown>);
}

export async function deleteDocument(collectionName: string, id: string) {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  return deleteDoc(doc(db, collectionName, id));
}
