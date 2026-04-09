"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createDocument, updateDocument, useEmployees, useVisaRecords } from "@/lib/hooks";
import { getDocumentStatus } from "@/lib/document-utils";
import type { Employee, VisaRecord } from "@/lib/types";
import { daysBetween, formatDate } from "@/lib/utils";

function badgeForDate(date?: string) {
  const days = daysBetween(date);
  if (days === null) return { variant: "gray" as const, label: "Not entered" };
  if (days < 0) return { variant: "red" as const, label: "EXPIRED" };
  if (days <= 30) return { variant: "orange" as const, label: `${days} days` };
  if (days <= 90) return { variant: "yellow" as const, label: `${days} days` };
  return { variant: "green" as const, label: `${days} days` };
}

export function IDDocumentTracker() {
  const { data: employees, loading: employeesLoading, error: employeesError } = useEmployees();
  const { data: visaRecords, loading: visasLoading, error: visasError } = useVisaRecords();
  const [showExpatsOnly, setShowExpatsOnly] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const recordsByEmployeeId = useMemo(() => new Map(visaRecords.map((record) => [record.employeeId, record])), [visaRecords]);

  const rows = useMemo(() => {
    return employees.filter((employee) => !showExpatsOnly || employee.type === "Expat");
  }, [employees, showExpatsOnly]);

  const summary = useMemo(() => {
    const allStatuses = rows.flatMap((employee) => [
      getDocumentStatus(employee.civilIdExpiry),
      getDocumentStatus(employee.passportExpiry),
      getDocumentStatus(employee.residencePermitExpiry),
      getDocumentStatus(employee.workPermitExpiry),
      getDocumentStatus(employee.laborCardExpiry),
    ]);
    return {
      expired: allStatuses.filter((status) => status === "expired").length,
      expiring30: allStatuses.filter((status) => status === "30").length,
      expiring90: allStatuses.filter((status) => status === "90").length,
      valid: allStatuses.filter((status) => status === "valid").length,
    };
  }, [rows]);

  function openEmployee(employee: Employee) {
    const visaRecord = recordsByEmployeeId.get(employee.id);
    setForm({
      civilId: employee.civilId ?? "",
      civilIdExpiry: employee.civilIdExpiry ?? "",
      passportNumber: employee.passportNumber ?? visaRecord?.passportNumber ?? "",
      passportExpiry: employee.passportExpiry ?? visaRecord?.passportExpiry ?? "",
      residencePermitExpiry: employee.residencePermitExpiry ?? visaRecord?.residencePermitExpiry ?? "",
      workPermitExpiry: employee.workPermitExpiry ?? visaRecord?.workPermitExpiry ?? "",
      laborCardExpiry: employee.laborCardExpiry ?? visaRecord?.laborCardExpiry ?? "",
      visaType: visaRecord?.visaType ?? "Employment",
      visaNumber: visaRecord?.visaNumber ?? "",
      issueDate: visaRecord?.issueDate ?? "",
      expiryDate: visaRecord?.expiryDate ?? "",
      notes: visaRecord?.notes ?? employee.notes ?? "",
    });
    setSelectedEmployee(employee);
  }

  async function saveChanges() {
    if (!selectedEmployee) return;
    try {
      await updateDocument<Employee>("employees", selectedEmployee.id, {
        civilId: form.civilId,
        civilIdExpiry: form.civilIdExpiry,
        passportNumber: form.passportNumber,
        passportExpiry: form.passportExpiry,
        residencePermitExpiry: form.residencePermitExpiry,
        workPermitExpiry: form.workPermitExpiry,
        laborCardExpiry: form.laborCardExpiry,
        notes: form.notes,
      });

      const existingVisa = recordsByEmployeeId.get(selectedEmployee.id);
      const visaPayload = {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        nationality: selectedEmployee.nationality,
        passportNumber: form.passportNumber,
        passportExpiry: form.passportExpiry,
        visaType: form.visaType,
        visaNumber: form.visaNumber,
        issueDate: form.issueDate,
        expiryDate: form.expiryDate,
        status: getDocumentStatus(form.expiryDate) === "expired" ? "expired" : getDocumentStatus(form.expiryDate) === "30" ? "pending_renewal" : "active",
        residencePermitExpiry: form.residencePermitExpiry,
        workPermitExpiry: form.workPermitExpiry,
        laborCardExpiry: form.laborCardExpiry,
        notes: form.notes,
      } satisfies Omit<VisaRecord, "id">;

      if (existingVisa) {
        await updateDocument<VisaRecord>("visaRecords", existingVisa.id, visaPayload);
      } else {
        await createDocument("visaRecords", visaPayload);
      }
      toast.success("Document details updated.");
      setSelectedEmployee(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update document records.";
      toast.error(message);
    }
  }

  if (employeesLoading || visasLoading) return <Spinner />;
  if (employeesError || visasError) return <EmptyState title="Unable to load document tracker" description={employeesError ?? visasError ?? "Please check Firebase access."} />;
  if (!employees.length) return <EmptyState title="No employees found" description="Seed employees before using the document tracker." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">ID & Document Expiry Tracker</h2>
          <p className="text-sm text-slate-500">Monitor Civil ID, passport, residence permit, work permit, and labour card expiry dates.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showExpatsOnly} onChange={(event) => setShowExpatsOnly(event.target.checked)} />
          Show Expats Only
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Expired", summary.expired],
          ["Expiring <=30", summary.expiring30],
          ["Expiring <=90", summary.expiring90],
          ["All Valid", summary.valid],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-3">
              <p className="text-sm text-slate-500">{label}</p>
              <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Civil ID</th>
                    <th className="pb-3">Passport</th>
                    <th className="pb-3">Residence Permit</th>
                    <th className="pb-3">Work Permit</th>
                    <th className="pb-3">Labour Card</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((employee) => (
                    <tr key={employee.id} className="cursor-pointer border-b last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-900" onClick={() => openEmployee(employee)}>
                      <td className="py-3">
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.employeeId}</p>
                      </td>
                      {[employee.civilIdExpiry, employee.passportExpiry, employee.residencePermitExpiry, employee.workPermitExpiry, employee.laborCardExpiry].map((date, index) => {
                        const info = badgeForDate(date);
                        const isExpatField = index >= 2;
                        if (isExpatField && employee.type !== "Expat") {
                          return <td key={`${employee.id}-${index}`} className="py-3 text-slate-400">N/A</td>;
                        }
                        return (
                          <td key={`${employee.id}-${index}`} className="py-3">
                            <div className="space-y-1">
                              <div>{formatDate(date)}</div>
                              <Badge variant={info.variant}>{info.label}</Badge>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No employees in this view" description="Toggle off the expat filter or add more records." />
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedEmployee)} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update document details</DialogTitle>
          </DialogHeader>
          {selectedEmployee ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["civilId", "Civil ID Number", "text"],
                ["civilIdExpiry", "Civil ID Expiry", "date"],
                ["passportNumber", "Passport Number", "text"],
                ["passportExpiry", "Passport Expiry", "date"],
                ["residencePermitExpiry", "Residence Permit Expiry", "date"],
                ["workPermitExpiry", "Work Permit Expiry", "date"],
                ["laborCardExpiry", "Labour Card Expiry", "date"],
                ["visaType", "Visa Type", "text"],
                ["visaNumber", "Visa Number", "text"],
                ["issueDate", "Issue Date", "date"],
                ["expiryDate", "Visa Expiry Date", "date"],
              ].map(([key, label, type]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input id={key} type={type} value={form[key] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
                </div>
              ))}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 md:col-span-2">
                <Button variant="outline" onClick={() => setSelectedEmployee(null)}>Cancel</Button>
                <Button onClick={saveChanges}>Save Changes</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
