"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { readBuyerAccount } from "@/lib/buyer-account";
import { cn } from "@/lib/utils";
import { useBuyerAuth } from "./buyer-auth-provider";

const NAV = [
  { href: "/buyer", label: "Shop", exact: true },
  { href: "/market", label: "Market" },
  { href: "/buyer/activity", label: "Activity" },
  { href: "/buyer/xpoints", label: "XPoints" },
  { href: "/buyer/profile", label: "Profile" },
  { href: "/buyer/governance", label: "Governance" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BuyerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useBuyerAuth();
  const [ready, setReady] = useState(false);

  const isAuthPage =
    pathname === "/buyer/login" || pathname === "/buyer/signup";
  const isOnboard = pathname === "/buyer/onboard";

  useEffect(() => {
    if (!auth.ready) return;

    // Without Firebase: keep localStorage-only gate
    if (!auth.configured) {
      const account = readBuyerAccount();
      if (!account && !isOnboard) {
        router.replace("/buyer/onboard");
        return;
      }
      if (account && isOnboard) {
        router.replace("/buyer");
        return;
      }
      setReady(true);
      return;
    }

    if (!auth.user && !isAuthPage) {
      router.replace("/buyer/login");
      return;
    }

    if (auth.user && isAuthPage) {
      const account = auth.account ?? readBuyerAccount();
      router.replace(account ? "/buyer" : "/buyer/onboard");
      return;
    }

    if (auth.user && !isAuthPage) {
      const account = auth.account ?? readBuyerAccount();
      if (!account && !isOnboard) {
        router.replace("/buyer/onboard");
        return;
      }
      if (account && isOnboard) {
        router.replace("/buyer");
        return;
      }
    }

    setReady(true);
  }, [
    auth.ready,
    auth.configured,
    auth.user,
    auth.account,
    pathname,
    isAuthPage,
    isOnboard,
    router,
  ]);

  if (!auth.ready || !ready) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <SiteHeader variant="buyer" />
        <main className="mx-auto max-w-[1400px] px-6 pt-24">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      </div>
    );
  }

  if (isOnboard || isAuthPage) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <SiteHeader variant="public" />
        {children}
        <p className="px-6 pb-8 text-center text-xs text-foreground/45">
          Not shopping?{" "}
          <Link
            href="/merchant/login"
            className="text-foreground/70 underline-offset-2 hover:underline"
          >
            Sell on Borneo
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <SiteHeader variant="buyer" />
      <div className="shrink-0 border-b border-border/60 bg-background/80 pt-16">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active = isActive(
                pathname,
                item.href,
                "exact" in item && item.exact,
              );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 border-b-2 px-3 py-3 text-sm transition-colors",
                    active
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-foreground/55 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <Link
            href="/merchant/login"
            className="hidden shrink-0 text-xs text-foreground/45 underline-offset-2 hover:underline sm:inline"
          >
            Sell instead
          </Link>
        </div>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          pathname === "/buyer" ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}
