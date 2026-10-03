"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { useMerchantAuth } from "@/app/merchant/_components/merchant-auth-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/merchant/setup", label: "Settings" },
  { href: "/onboard", label: "Publish" },
  { href: "/dashboard", label: "Ops" },
  { href: "/market", label: "Market" },
  { href: "/buyer/login", label: "Prefer to buy" },
] as const;

function isActive(pathname: string, href: string) {
  if (href.startsWith("/buyer") || href === "/market") return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const merchant = useMerchantAuth();

  const isAuthPage =
    pathname === "/merchant/login" || pathname === "/merchant/signup";

  if (isAuthPage) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <SiteHeader variant="public" />
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <SiteHeader variant="merchant" />
      <div className="shrink-0 border-b border-border/60 bg-background/80 pt-16">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-6">
          <div className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const externalRole =
                item.href.startsWith("/buyer") || item.href === "/market";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 border-b-2 px-3 py-3 text-sm transition-colors",
                    active
                      ? "border-foreground font-medium text-foreground"
                      : externalRole
                        ? "border-transparent text-foreground/45 hover:text-foreground"
                        : "border-transparent text-foreground/55 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          {merchant.user ? (
            <button
              type="button"
              className="shrink-0 text-xs text-foreground/50 underline-offset-2 hover:underline"
              onClick={() =>
                void merchant
                  .signOut()
                  .then(() => router.push("/merchant/login"))
              }
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
