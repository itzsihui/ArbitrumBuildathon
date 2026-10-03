import { MerchantAuthProvider } from "@/app/merchant/_components/merchant-auth-provider";
import { MerchantShell } from "@/app/merchant/_components/merchant-shell";

export default function OnboardLayout({
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
