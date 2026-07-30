"use client";

import { AdminProvider } from "@/components/admin-console";
import {
  LinkProvider,
  type LinkComponentProps,
} from "@cloudflare/kumo";
import NextLink from "next/link";
import { forwardRef, type ReactNode } from "react";

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  function AppLink({ href, to, ...props }, ref) {
    return <NextLink href={href ?? to ?? ""} ref={ref} {...props} />;
  },
);

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LinkProvider component={AppLink}>
      <AdminProvider>{children}</AdminProvider>
    </LinkProvider>
  );
}
