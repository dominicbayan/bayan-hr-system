"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createDocument, updateDocument, useEmployees, useOnboarding } from "@/lib/hooks";
import type { OnboardingRecord } from "@/lib/types";

const defaultTasks = [
  "Offer accepted",
  "Documents received",
  "Accounts provisioned",
  "Orientation scheduled",
  "Manager briefing completed",
];

export function OnboardingSection() {
  const { data: employees, loading: employeesLoading, error: employeesError } = useEmployees();
  const { data: onboarding, loading: onboardingLoading, error: onboardingError } = useOnboarding();
  const [employeeId, setEmployeeId] = useState("");
  const [manager, setManager] = useState("");
  const [startDate, setStartDate] = useState("");
  const [department, setDepartment] = useState("");
  const [notes, setNotes] = useState("");

  const selectedEmployee = useMemo(() => employees.find((employee) => employee.id === employeeId), [employeeId, employees]);

  async function createPlan() {
    if (!selectedEmployee || !startDate) {
      toast.error("Select an employee and start date.");
      return;
    }

    try {
      await createDocument("onboarding", {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        startDate,
        department: department || selectedEmployee.department,
        manager,
        progress: 0,
        tasks: defaultTasks.map((label) => ({ label, completed: false })),
        notes,
      });
      toast.success("Onboarding plan created.");
      setEmployeeId("");
      setManager("");
      setStartDate("");
      setDepartment("");
      setNotes("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create onboarding plan.";
      toast.error(message);
    }
  }

  async function toggleTask(record: OnboardingRecord, index: number, checked: boolean) {
    const tasks = record.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, completed: checked } : task);
    const progress = Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100);

    try {
      await updateDocument<OnboardingRecord>("onboarding", record.id, { tasks, progress });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update onboarding task.";
      toast.error(message);
    }
  }

  if (employeesLoading || onboardingLoading) return <Spinner />;
  if (employeesError || onboardingError) return <EmptyState title="Unable to load onboarding" description={employeesError ?? onboardingError ?? "Please check Firebase access."} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Onboarding</h2>
        <p className="text-sm text-slate-500">Track onboarding progress with Firestore-backed task lists.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Onboarding Plan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Employee</Label>
            <select className="h-10 rounded-lg border bg-transparent px-3 text-sm" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Select employee</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Input value={department} onChange={(event) => setDepartment(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Manager</Label>
            <Input value={manager} onChange={(event) => setManager(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={createPlan}>Create Plan</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Onboarding Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {onboarding.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {onboarding.map((record) => (
                <div key={record.id} className="rounded-2xl border p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{record.employeeName}</h3>
                      <p className="text-sm text-slate-500">{record.department || "Department not set"} · {record.manager || "Manager not set"}</p>
                    </div>
                    <div className="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">{record.progress}%</div>
                  </div>
                  <div className="space-y-3">
                    {record.tasks.map((task, index) => (
                      <label key={task.label} className="flex items-center gap-3 text-sm">
                        <Checkbox checked={task.completed} onCheckedChange={(checked) => toggleTask(record, index, Boolean(checked))} />
                        <span>{task.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No onboarding plans yet" description="Create a plan for new joiners or internal transfers." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
