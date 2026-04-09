import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Employee } from "@/lib/types";

const employees: Omit<Employee, "id">[] = [
  { employeeId: "1001", name: "Fahad Mohamed Hilal Al Khalili", email: "1001@bayanhr.local", phone: "", type: "Management", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1002", name: "Shafiya Ahmed Al Khalili", email: "1002@bayanhr.local", phone: "", type: "Other", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1003", name: "Dominic Yuvan Raja", email: "1003@bayanhr.local", phone: "", type: "Expat", nationality: "Non-Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1004", name: "Saqar Mohamed Hilal Al Khalili", email: "1004@bayanhr.local", phone: "", type: "Other", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1005", name: "Badar Khalaf Saleh Al Maawali", email: "1005@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1006", name: "Mohamed Ali Nasser Al Muniri", email: "1006@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1007", name: "Mohamed Fahad Al Khalili", email: "1007@bayanhr.local", phone: "", type: "Management", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1008", name: "Salim Said Saayid Al Rahbi", email: "1008@bayanhr.local", phone: "", type: "Other", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1009", name: "Nafisa Nasrullah Rasool Bakhsh Al Balushi", email: "1009@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1010", name: "Shahad Ahmed Khalfan Al Habsi", email: "1010@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1011", name: "Al Waleed Zahir Sulaiman Al Subhi", email: "1011@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1012", name: "Noof Amur Rashid Al Maamari", email: "1012@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1013", name: "Ahad Hamood Mohammed Al Hinai", email: "1013@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1014", name: "Mohammed Rahim Uddin", email: "1014@bayanhr.local", phone: "", type: "Expat", nationality: "Non-Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1015", name: "Misbah Ashfaq", email: "1015@bayanhr.local", phone: "", type: "Expat", nationality: "Non-Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1016", name: "Loqman Al Shibani", email: "1016@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "1017", name: "Khalil Ahmed Al Harthi", email: "1017@bayanhr.local", phone: "", type: "Omani", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "2001", name: "Maria Lourdes Menosa Marcos", email: "2001@bayanhr.local", phone: "", type: "Household", nationality: "Non-Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "2002", name: "Mohamed Saleh Mohamed", email: "2002@bayanhr.local", phone: "", type: "Household", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "2003", name: "Ahammadar Rahman", email: "2003@bayanhr.local", phone: "", type: "Household", nationality: "Non-Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "2004", name: "Ahmed Fahad Al Khalili", email: "2004@bayanhr.local", phone: "", type: "Household", nationality: "Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "2005", name: "Khurshid Hussain Gajula", email: "2005@bayanhr.local", phone: "", type: "Household", nationality: "Non-Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
  { employeeId: "2006", name: "Frances Sharmane Aquino Cuenco", email: "2006@bayanhr.local", phone: "", type: "Expat", nationality: "Non-Omani", position: "", department: "", joinDate: "2024-01-01", status: "active" },
];

export async function runSeed() {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const seedRef = doc(db, "meta", "seed");
  const existingEmployees = await getDocs(query(collection(db, "employees"), limit(1)));

  if (!existingEmployees.empty) {
    return { seeded: false, message: "Seed already completed." };
  }

  for (const employee of employees) {
    await addDoc(collection(db, "employees"), employee);
  }

  await setDoc(seedRef, {
    seededAt: serverTimestamp(),
    employeeCount: employees.length,
  });

  return { seeded: true, count: employees.length };
}
