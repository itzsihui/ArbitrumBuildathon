import { redirect } from "next/navigation";

/** Legacy URL — XPoints now lives at /buyer/xpoints. */
export default function LegacyOwnershipPage() {
  redirect("/buyer/xpoints");
}
