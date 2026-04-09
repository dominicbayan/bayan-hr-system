import type { Metadata } from "next";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/context/AuthContext";

import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Bayan Investment House HR System",
  description: "HR management system for Bayan Investment House LLC in Muscat, Oman.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
