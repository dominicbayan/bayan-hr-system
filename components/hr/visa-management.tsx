"use client";

import {
  addDoc,
  collection,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  Briefcase,
  Eye,
  FileArchive,
  FileBadge,
  FileCheck,
  FilePlus2,
  FileSearch,
  FileText,
  GraduationCap,
  IdCard,
  Search,
  ShieldCheck,
  Stethoscope,
  Upload,
} from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { useAllEmployeeDocuments, useEmployeeDocuments, useEmployees } from "@/lib/hooks";
import {
  buildDocumentUploadPath,
  categoryLabels,
  getCategoriesForEmployee,
  getDocumentForCategory,
  getDocumentStatusFromExpiry,
  getEmployeeDocumentHealth,
  getStatusMeta,
  hasMissingRequiredDocuments,
} from "@/lib/document-center";
import type { DocumentCategory, Employee, EmployeeDocument } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const categoryIcons = {
  civil_id: IdCard,
  passport: IdCard,
  residence_permit: ShieldCheck,
  work_permit: Briefcase,
  labor_card: FileBadge,
  visa: FileCheck,
  medical_fitness: Stethoscope,
  police_clearance: FileSearch,
  education_cert: GraduationCap,
  employment_contract: FileText,
  other: FileArchive,
} satisfies Record<DocumentCategory, React.ComponentType<{ className?: string }>>;

type FilterMode = "all" | "expats" | "missing";
type ModalMode = "upload" | "replace" | "edit";

interface ModalState {
  open: boolean;
  mode: ModalMode;
  category: DocumentCategory;
  targetDocument: EmployeeDocument | null;
}

const supportedFileTypes = ["application/pdf", "image/jpeg", "image/png"];

const emptyModalState: ModalState = {
  open: false,
  mode: "upload",
  category: "passport",
  targetDocument: null,
};

function createInitialForm(category: DocumentCategory) {
  return {
    category,
    name: categoryLabels[category],
    documentNumber: "",
    issueDate: "",
    expiryDate: "",
    issuingAuthority: "",
    issuingCountry: "Oman",
    notes: "",
  };
}

function toLatestDocumentsMap(documents: EmployeeDocument[]) {
  const byEmployee = new Map<string, Map<DocumentCategory, EmployeeDocument>>();

  documents.forEach((document) => {
    const employeeMap = byEmployee.get(document.employeeId) ?? new Map<DocumentCategory, EmployeeDocument>();
    const current = employeeMap.get(document.category);

    if (!current || current.uploadedAt < document.uploadedAt) {
      employeeMap.set(document.category, document);
    }

    byEmployee.set(document.employeeId, employeeMap);
  });

  return byEmployee;
}

function openDocumentInNewTab(fileUrl: string) {
  window.open(fileUrl, "_blank", "noopener,noreferrer");
}

function downloadDocument(fileUrl: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = fileUrl;
  anchor.download = fileName;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.click();
}

export function IDDocumentTracker() {
  const { user } = useAuth();
  const { data: employees, loading: employeesLoading, error: employeesError } = useEmployees();
  const { data: allDocuments, loading: allDocumentsLoading, error: allDocumentsError } = useAllEmployeeDocuments();
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(emptyModalState);
  const [form, setForm] = useState(createInitialForm("passport"));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const latestDocumentsByEmployee = useMemo(() => toLatestDocumentsMap(allDocuments), [allDocuments]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !query ||
        employee.name.toLowerCase().includes(query) ||
        employee.employeeId.toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }

      if (filterMode === "expats") {
        return employee.type === "Expat";
      }

      if (filterMode === "missing") {
        const employeeDocuments = Array.from(latestDocumentsByEmployee.get(employee.id)?.values() ?? []);
        return hasMissingRequiredDocuments(employee, employeeDocuments);
      }

      return true;
    });
  }, [employees, filterMode, latestDocumentsByEmployee, search]);

  const selectedEmployee =
    filteredEmployees.find((employee) => employee.id === selectedEmployeeId) ?? filteredEmployees[0] ?? null;
  const { data: selectedEmployeeDocuments, loading: selectedDocumentsLoading, error: selectedDocumentsError } =
    useEmployeeDocuments(selectedEmployee?.id ?? null);

  const latestSelectedDocuments = useMemo(
    () => Array.from(toLatestDocumentsMap(selectedEmployeeDocuments).get(selectedEmployee?.id ?? "")?.values() ?? []),
    [selectedEmployee?.id, selectedEmployeeDocuments],
  );

  function openModal(mode: ModalMode, category: DocumentCategory, targetDocument: EmployeeDocument | null = null) {
    setSelectedFile(null);

    if (targetDocument) {
      setForm({
        category: targetDocument.category,
        name: targetDocument.name,
        documentNumber: targetDocument.documentNumber,
        issueDate: targetDocument.issueDate,
        expiryDate: targetDocument.expiryDate,
        issuingAuthority: targetDocument.issuingAuthority,
        issuingCountry: targetDocument.issuingCountry,
        notes: targetDocument.notes,
      });
    } else {
      setForm(createInitialForm(category));
    }

    setModalState({
      open: true,
      mode,
      category,
      targetDocument,
    });
  }

  async function handleSaveDocument() {
    if (!selectedEmployee || !db) {
      toast.error("Select an employee before saving a document.");
      return;
    }

    if (!user?.email) {
      toast.error("You must be signed in to manage documents.");
      return;
    }

    if (!form.name.trim() || !form.documentNumber.trim()) {
      toast.error("Document name and document number are required.");
      return;
    }

    if (!form.issueDate || !form.expiryDate) {
      toast.error("Issue date and expiry date are required.");
      return;
    }

    const currentStatus = getDocumentStatusFromExpiry(form.expiryDate);

    try {
      setSaving(true);

      if (modalState.mode === "edit" && modalState.targetDocument) {
        const targetRef = doc(db, "employees", selectedEmployee.id, "documents", modalState.targetDocument.id);
        await updateDoc(targetRef, {
          category: form.category,
          name: form.name.trim(),
          documentNumber: form.documentNumber.trim(),
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          issuingAuthority: form.issuingAuthority.trim(),
          issuingCountry: form.issuingCountry.trim(),
          notes: form.notes.trim(),
          status: currentStatus,
        });
        toast.success("Document details updated.");
      } else {
        if (!storage) {
          toast.error("Firebase Storage is not configured.");
          return;
        }

        if (!selectedFile) {
          toast.error("Select a document file to upload.");
          return;
        }

        if (!supportedFileTypes.includes(selectedFile.type)) {
          toast.error("Only PDF, JPG, and PNG files are supported.");
          return;
        }

        const storagePath = buildDocumentUploadPath(selectedEmployee.employeeId, form.category, selectedFile.name);
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, selectedFile);
        const fileUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, "employees", selectedEmployee.id, "documents"), {
          employeeId: selectedEmployee.id,
          category: form.category,
          name: form.name.trim(),
          documentNumber: form.documentNumber.trim(),
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          issuingAuthority: form.issuingAuthority.trim(),
          issuingCountry: form.issuingCountry.trim(),
          notes: form.notes.trim(),
          fileUrl,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          uploadedAt: new Date().toISOString(),
          uploadedBy: user.email,
          status: currentStatus,
        });

        toast.success(modalState.mode === "replace" ? "New document version uploaded." : "Document uploaded.");
      }

      setModalState(emptyModalState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save document.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (employeesLoading || allDocumentsLoading) {
    return <Spinner />;
  }

  if (employeesError || allDocumentsError) {
    return (
      <EmptyState
        title="Unable to load document center"
        description={employeesError ?? allDocumentsError ?? "Please check Firebase configuration and permissions."}
      />
    );
  }

  if (!employees.length) {
    return <EmptyState title="No employees found" description="Seed employees before using the ID & Document Center." />;
  }

  const selectedEmployeeHealth = selectedEmployee
    ? getEmployeeDocumentHealth(selectedEmployee, latestSelectedDocuments)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">ID & Document Center</h2>
        <p className="text-sm text-slate-500">
          Manage employee document profiles, renewals, and Storage-backed uploads from one place.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="xl:h-[calc(100vh-13rem)]">
          <CardHeader>
            <CardTitle>Employees</CardTitle>
            <div className="space-y-3 pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or employee ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["all", "All"],
                  ["expats", "Expats Only"],
                  ["missing", "Missing Documents"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={filterMode === value ? "default" : "outline"}
                    onClick={() => setFilterMode(value as FilterMode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto pb-6">
            {filteredEmployees.length ? (
              filteredEmployees.map((employee) => {
                const employeeDocuments = Array.from(latestDocumentsByEmployee.get(employee.id)?.values() ?? []);
                const health = getEmployeeDocumentHealth(employee, employeeDocuments);

                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => setSelectedEmployeeId(employee.id)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition",
                      selectedEmployee?.id === employee.id
                        ? "border-teal-600 bg-teal-50 dark:border-teal-500 dark:bg-teal-950/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-900",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.employeeId}</p>
                      </div>
                      <Badge variant={employee.type === "Expat" ? "orange" : employee.nationality === "Omani" ? "green" : "default"}>
                        {employee.type}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <span className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        health.tone === "red" && "bg-red-500",
                        health.tone === "orange" && "bg-orange-500",
                        health.tone === "yellow" && "bg-yellow-500",
                        health.tone === "green" && "bg-emerald-500",
                        health.tone === "gray" && "bg-slate-300",
                      )} />
                      <span>{health.label}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyState title="No matching employees" description="Adjust the search text or employee filter." />
            )}
          </CardContent>
        </Card>

        <Card>
          {selectedEmployee ? (
            <>
              <CardHeader>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{selectedEmployee.name}</CardTitle>
                      <Badge variant={selectedEmployee.type === "Expat" ? "orange" : selectedEmployee.nationality === "Omani" ? "green" : "default"}>
                        {selectedEmployee.type}
                      </Badge>
                      <Badge variant={selectedEmployeeHealth?.tone ?? "gray"}>{selectedEmployeeHealth?.label ?? "No documents"}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {selectedEmployee.employeeId} · {selectedEmployee.nationality}
                    </p>
                  </div>
                  <Button className="gap-2" onClick={() => openModal("upload", getCategoriesForEmployee(selectedEmployee)[0])}>
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDocumentsLoading ? (
                  <Spinner />
                ) : selectedDocumentsError ? (
                  <EmptyState title="Unable to load employee documents" description={selectedDocumentsError} />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {getCategoriesForEmployee(selectedEmployee).map((category) => {
                      const Icon = categoryIcons[category];
                      const document = getDocumentForCategory(latestSelectedDocuments, category);

                      if (!document) {
                        return (
                          <button
                            key={category}
                            type="button"
                            className="rounded-2xl border border-dashed p-5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900"
                            onClick={() => openModal("upload", category)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium">{categoryLabels[category]}</p>
                                <p className="text-sm text-slate-500">Pending upload</p>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300">
                              <FilePlus2 className="h-4 w-4" />
                              Upload
                            </div>
                          </button>
                        );
                      }

                      const statusMeta = getStatusMeta(document.status, document.expiryDate);
                      const isPdf = document.fileType === "application/pdf";

                      return (
                        <div key={category} className="rounded-2xl border p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium">{categoryLabels[category]}</p>
                                <p className="text-sm text-slate-500">{document.documentNumber}</p>
                              </div>
                            </div>
                            <Badge variant={statusMeta.tone}>{statusMeta.label}</Badge>
                          </div>

                          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <p>Expiry: {formatDate(document.expiryDate)}</p>
                            <p>Authority: {document.issuingAuthority || "Not specified"}</p>
                            <p>Country: {document.issuingCountry || "Not specified"}</p>
                          </div>

                          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                            {isPdf ? <FileText className="h-8 w-8 text-red-500" /> : <FileArchive className="h-8 w-8 text-sky-500" />}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{document.fileName}</p>
                              <p className="text-xs text-slate-500">{Math.round(document.fileSize / 1024)} KB</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openDocumentInNewTab(document.fileUrl)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => downloadDocument(document.fileUrl, document.fileName)}>
                              Download
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openModal("replace", category, document)}>
                              Replace
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openModal("edit", category, document)}>
                              Edit Details
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="pt-6">
              <EmptyState title="No employee selected" description="Choose an employee from the left panel to open the full document profile." />
            </CardContent>
          )}
        </Card>
      </div>

      <Dialog open={modalState.open} onOpenChange={(open) => !open && setModalState(emptyModalState)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalState.mode === "edit"
                ? "Edit Document Details"
                : modalState.mode === "replace"
                  ? "Replace Document"
                  : "Upload Document"}
            </DialogTitle>
            <DialogDescription>
              Upload files to Firebase Storage using the employee/category folder structure.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Document Category</Label>
              <select
                id="category"
                className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm"
                value={form.category}
                onChange={(event) => {
                  const category = event.target.value as DocumentCategory;
                  setForm((current) => ({ ...current, category, name: current.name || categoryLabels[category] }));
                }}
              >
                {selectedEmployee
                  ? getCategoriesForEmployee(selectedEmployee).map((category) => (
                      <option key={category} value={category}>
                        {categoryLabels[category]}
                      </option>
                    ))
                  : null}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Document Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentNumber">Document Number</Label>
              <Input
                id="documentNumber"
                value={form.documentNumber}
                onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={form.issueDate}
                onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                type="date"
                value={form.expiryDate}
                onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuingAuthority">Issuing Authority</Label>
              <Input
                id="issuingAuthority"
                value={form.issuingAuthority}
                onChange={(event) => setForm((current) => ({ ...current, issuingAuthority: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="issuingCountry">Issuing Country</Label>
              <Input
                id="issuingCountry"
                value={form.issuingCountry}
                onChange={(event) => setForm((current) => ({ ...current, issuingCountry: event.target.value }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            {modalState.mode !== "edit" ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="file">Document File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-slate-500">Accepted types: PDF, JPG, PNG.</p>
              </div>
            ) : null}

            <div className="flex justify-end gap-3 md:col-span-2">
              <Button variant="outline" onClick={() => setModalState(emptyModalState)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDocument} disabled={saving}>
                {saving ? "Saving..." : modalState.mode === "edit" ? "Save Details" : modalState.mode === "replace" ? "Upload Replacement" : "Upload Document"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
