"use client";

import {
  Calendar,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import type { HrSection } from "@/lib/types";
import { Button } from "@/components/ui/button";

const navItems: Array<{ key: HrSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "employees", label: "Employees", icon: Users },
  { key: "documents", label: "ID & Documents", icon: ShieldCheck },
  { key: "leave-management", label: "Leave Management", icon: Calendar },
  { key: "leave-request", label: "Leave Request", icon: ClipboardList },
  { key: "attendance", label: "Attendance", icon: CalendarDays },
  { key: "onboarding", label: "Onboarding", icon: UserPlus },
  { key: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  activeSection,
  onSelect,
}: {
  activeSection: HrSection;
  onSelect: (section: HrSection) => void;
}) {
  const { user, signOutUser } = useAuth();

  return (
    <aside className="flex h-full flex-col border-r bg-white dark:bg-slate-950">
      <div className="border-b px-6 py-6">
        <h2 className="text-lg font-semibold">Bayan Investment House</h2>
        <p className="text-sm text-slate-500">HR System - Muscat, Oman</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeSection;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                isActive
                  ? "bg-teal-600 text-white"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 border-t px-4 py-4">
        <div className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500">Signed in as</p>
          <p className="truncate font-medium">{user?.email ?? "Unknown user"}</p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={async () => {
            await signOutUser();
            toast.success("Signed out.");
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
