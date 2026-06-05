import "./globals.css";
import { Manrope } from "next/font/google";
import { Toaster } from "sonner";
import ClientLayout from "@/components/layout/ClientLayout";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata = {
  title: "Zoom Meeting Management",
  description: "Enterprise Zoom Meeting Management Platform",
};

export const viewport = {
  themeColor: "#2B3990",
};

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["500", "600", "700", "800"],
});

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
        </AuthProvider>
        <Toaster
          richColors
          closeButton
          position="top-right"
          toastOptions={{
            duration: 4200,
            style: {
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
            },
            classNames: {
              success: "!border-emerald-200",
              error: "!border-red-200",
              warning: "!border-amber-200",
              info: "!border-[#2B3990]/25",
              actionButton: "!bg-[#2B3990] !text-white",
              cancelButton: "!bg-slate-100 !text-slate-700",
            },
          }}
        />
      </body>
    </html>
  );
}
