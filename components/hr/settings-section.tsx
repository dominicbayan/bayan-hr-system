"use client";

import { useState } from "react";

import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export function SettingsSection() {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState("Bayan Investment House LLC");
  const [location, setLocation] = useState("Muscat, Oman");
  const [industry, setIndustry] = useState("Investment House");
  const [alert90, setAlert90] = useState(true);
  const [alert30, setAlert30] = useState(true);
  const [omanisationTarget, setOmanisationTarget] = useState("35");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-slate-500">Company profile, notifications, Omanisation target, theme, and account details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={location} onChange={(event) => setLocation(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Input value={industry} onChange={(event) => setIndustry(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={alert90} onChange={(event) => setAlert90(event.target.checked)} />
            Document expiry alerts at 90 days
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={alert30} onChange={(event) => setAlert30(event.target.checked)} />
            Document expiry alerts at 30 days
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Omanisation Target</CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm space-y-2">
          <Label>Target %</Label>
          <Input value={omanisationTarget} onChange={(event) => setOmanisationTarget(event.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Logged in user</p>
          <p className="font-medium">{user?.email ?? "No user signed in"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
