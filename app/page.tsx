"use client";

import { Menu, X } from "lucide-react";
import { useMemo, useState } from "react";

import { DashboardOverview } from "@/components/hr/dashboard-overview";
import { EmployeeManagement } from "@/components/hr/employee-management";
import { LeaveManagement } from "@/components/hr/leave-management";
import { LeaveRequestForm } from "@/components/hr/leave-request-form";
import { SettingsSection } from "@/components/hr/settings-section";
import { Sidebar } from "@/components/hr/sidebar";
import { IDDocumentTracker } from "@/components/hr/visa-management";
import { ProtectedRoute } from "@/components/providers/protected-route";
import { Button } from "@/components/ui/button";
import type { HrSection } from "@/lib/types";

export default function HomePage() {
  const [activeSection, setActiveSection] = useState<HrSection>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const content = useMemo(() => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardOverview onOpenPendingLeave={() => setActiveSection("leave-management")} />;
      case "employees":
        return <EmployeeManagement />;
      case "documents":
        return <IDDocumentTracker />;
      case "leave-management":
        return <LeaveManagement />;
      case "leave-request":
        return <LeaveRequestForm />;
      case "settings":
        return <SettingsSection />;
      default:
        return <DashboardOverview />;
    }
  }, [activeSection]);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 w-72 transition-transform md:static md:translate-x-0`}>
          <Sidebar
            activeSection={activeSection}
            onSelect={(section) => {
              setActiveSection(section);
              setMobileOpen(false);
            }}
          />
        </div>

        {mobileOpen ? <button className="fixed inset-0 z-30 bg-slate-950/50 md:hidden" onClick={() => setMobileOpen(false)} /> : null}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur dark:bg-slate-950/90 md:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Bayan Investment House</p>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">HR Management System</h1>
            </div>
            <Button variant="outline" className="md:hidden" onClick={() => setMobileOpen((value) => !value)}>
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </header>

          <main className="flex-1 p-4 md:p-8">{content}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
