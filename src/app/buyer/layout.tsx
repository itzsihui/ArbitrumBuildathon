import { BuyerAuthProvider } from "./_components/buyer-auth-provider";
import { BuyerShell } from "./_components/buyer-shell";

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <BuyerAuthProvider>
      <BuyerShell>{children}</BuyerShell>
    </BuyerAuthProvider>
  );
}
