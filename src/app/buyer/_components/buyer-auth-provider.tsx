"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "firebase/auth";
import {
  authErrorMessage,
  loadBuyerFromCloud,
  signInBuyer,
  signOutBuyer,
  signUpBuyer,
  subscribeAuth,
} from "@/lib/firebase/buyer-auth";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import {
  readBuyerAccount,
  setBuyerCloudSyncUid,
  writeBuyerAccount,
  type BuyerAccount,
} from "@/lib/buyer-account";

type BuyerAuthContextValue = {
  configured: boolean;
  ready: boolean;
  user: User | null;
  account: BuyerAccount | null;
  refreshAccount: () => Promise<void>;
  signUp: (args: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  errorMessage: (err: unknown) => string;
};

const BuyerAuthContext = createContext<BuyerAuthContextValue | null>(null);

export function BuyerAuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<BuyerAccount | null>(null);

  const refreshAccount = useCallback(async () => {
    if (user) {
      const cloud = await loadBuyerFromCloud(user.uid);
      if (cloud) {
        writeBuyerAccount(cloud);
        setAccount(cloud);
        return;
      }
    }
    setAccount(readBuyerAccount());
  }, [user]);

  useEffect(() => {
    if (!configured) {
      setAccount(readBuyerAccount());
      setReady(true);
      return;
    }

    const unsub = subscribeAuth(async (next) => {
      setUser(next);
      setBuyerCloudSyncUid(next?.uid ?? null);
      if (next) {
        const cloud = await loadBuyerFromCloud(next.uid);
        if (cloud) {
          writeBuyerAccount(cloud);
          setAccount(cloud);
        } else {
          // New auth user without profile doc yet — keep any local draft
          setAccount(readBuyerAccount());
        }
      } else {
        setAccount(null);
      }
      setReady(true);
    });
    return () => unsub();
  }, [configured]);

  const value = useMemo<BuyerAuthContextValue>(
    () => ({
      configured,
      ready,
      user,
      account,
      refreshAccount,
      signUp: async (args) => {
        const { account: created } = await signUpBuyer(args);
        setAccount(created);
      },
      signIn: async (email, password) => {
        const { account: loaded } = await signInBuyer(email, password);
        setAccount(loaded);
      },
      signOut: async () => {
        await signOutBuyer();
        setBuyerCloudSyncUid(null);
        setAccount(null);
        setUser(null);
      },
      errorMessage: authErrorMessage,
    }),
    [configured, ready, user, account, refreshAccount],
  );

  return (
    <BuyerAuthContext.Provider value={value}>
      {children}
    </BuyerAuthContext.Provider>
  );
}

export function useBuyerAuth() {
  const ctx = useContext(BuyerAuthContext);
  if (!ctx) {
    throw new Error("useBuyerAuth must be used within BuyerAuthProvider");
  }
  return ctx;
}
