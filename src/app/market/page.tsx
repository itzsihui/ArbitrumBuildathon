import { Suspense } from "react";
import { MarketClient } from "@/components/market/market-client";

export default function MarketPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-foreground/55">
          Loading market…
        </div>
      }
    >
      <MarketClient />
    </Suspense>
  );
}
