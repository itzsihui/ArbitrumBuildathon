"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBuyerAuth } from "../_components/buyer-auth-provider";

export default function BuyerSignupPage() {
  const router = useRouter();
  const auth = useBuyerAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Enter a display name");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.signUp({
        email,
        password,
        displayName: displayName.trim(),
      });
      // Account doc already in Firestore — optional limits next
      router.replace("/buyer/onboard");
    } catch (err) {
      setError(auth.errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!auth.configured) {
    return (
      <main className="mx-auto max-w-md px-6 pt-24">
        <p className="text-sm text-muted-foreground">
          Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* keys to{" "}
          <code className="font-mono">.env</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 pt-24 pb-12">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Shop · Buyer account
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Create account
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          Does not create a merchant account. Rules and addresses stay with this
          shopper profile in Firestore.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Display name
          </label>
          <Input
            id="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="h-10"
            placeholder="e.g. Alex"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">At least 6 characters.</p>
        </div>
        <Button type="submit" disabled={busy} className="h-10 w-full px-4">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>

      <p className="text-sm text-foreground/60">
        Already have an account?{" "}
        <Link href="/buyer/login" className="text-foreground underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
      <p className="text-xs text-foreground/45">
        Want to sell instead?{" "}
        <Link
          href="/merchant/login"
          className="text-foreground/70 underline-offset-2 hover:underline"
        >
          Merchant sign in
        </Link>
      </p>
    </main>
  );
}
