import { MerchantAuthProvider } from "./_components/merchant-auth-provider";
import { MerchantShell } from "./_components/merchant-shell";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MerchantAuthProvider>
      <MerchantShell>{children}</MerchantShell>
    </MerchantAuthProvider>
  );
}
