"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ServiceWorkerRegistrar } from "./pwa/service-worker-registrar";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ duration: 3500 }}
      />
      <ServiceWorkerRegistrar />
    </ThemeProvider>
  );
}
