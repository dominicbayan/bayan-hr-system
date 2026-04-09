"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, firebaseConfigured } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    if (!firebaseConfigured || !auth) {
      setError("Firebase is not configured yet. Add your NEXT_PUBLIC_FIREBASE_ values to .env.local.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success("Signed in successfully.");
      router.replace("/");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to sign in.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm text-slate-500">Bayan Investment House</p>
          <CardTitle>Sign in to HR System</CardTitle>
        </CardHeader>
        <CardContent>
          {!firebaseConfigured ? (
            <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
              Firebase is not configured. Add your `NEXT_PUBLIC_FIREBASE_*` values in `.env.local`.
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input id="email" type="email" className="pl-9" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input id="password" type="password" className="pl-9" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
