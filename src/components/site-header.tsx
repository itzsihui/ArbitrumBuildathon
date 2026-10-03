import Link from "next/link";
import { cn } from "@/lib/utils";

export type SiteHeaderVariant = "public" | "buyer" | "merchant";

export function SiteHeader({
  className,
  tone = "light",
  variant = "public",
}: {
  className?: string;
  /** Agent discovery / dark surfaces need light nav ink */
  tone?: "light" | "dark";
  /** public = Shop/Sell; buyer = Market; merchant = brand only (shell owns nav) */
  variant?: SiteHeaderVariant;
}) {
  const dark = tone === "dark";

  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-20 h-16 border-b backdrop-blur-md",
        dark
          ? "border-neutral-800 bg-neutral-950/90"
          : "border-border/60 bg-background/80",
        className,
      )}
    >
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">
        <Link
          href="/"
          className={cn(
            "font-[family-name:var(--font-syne)] text-lg font-extrabold tracking-[-0.04em]",
            dark ? "text-neutral-100" : "text-foreground",
          )}
        >
          Borneo
        </Link>
        <nav
          className={cn(
            "flex items-center gap-5 text-sm",
            dark ? "text-neutral-300" : "text-foreground/65",
          )}
        >
          {variant === "public" ? (
            <>
              <Link
                href="/buyer/login"
                className={dark ? "hover:text-white" : "hover:text-foreground"}
              >
                Shop
              </Link>
              <Link
                href="/merchant/login"
                className={dark ? "hover:text-white" : "hover:text-foreground"}
              >
                Sell
              </Link>
            </>
          ) : null}
          {variant === "buyer" ? (
            <>
              <Link
                href="/buyer"
                className={dark ? "hover:text-white" : "hover:text-foreground"}
              >
                Shop
              </Link>
              <Link
                href="/market"
                className={dark ? "hover:text-white" : "hover:text-foreground"}
              >
                Market
              </Link>
            </>
          ) : null}
          {/* merchant: nav lives in MerchantShell — avoid duplicate Publish/Ops */}
        </nav>
      </div>
    </header>
  );
}
