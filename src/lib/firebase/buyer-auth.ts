import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  EMPTY_POLICY,
  type BuyerAccount,
  writeBuyerAccount,
  normalizeBuyerAccount,
  setBuyerCloudSyncUid,
  clearBuyerAccount,
} from "@/lib/buyer-account";
import { clearBuyerShopSession } from "@/lib/demo-session";
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "./client";

const BUYERS = "buyers";

/** Firestore rejects `undefined` field values. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buyerDocPath(uid: string) {
  return `${BUYERS}/${uid}`;
}

export async function signUpBuyer(args: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: User; account: BuyerAccount }> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  if (!auth || !db) throw new Error("Firebase is not configured");

  // Don't inherit a previous demo profile / stuck chat
  clearBuyerAccount();
  clearBuyerShopSession();

  const cred = await createUserWithEmailAndPassword(
    auth,
    args.email.trim(),
    args.password,
  );
  const name = args.displayName.trim() || "Buyer";
  await updateProfile(cred.user, { displayName: name });

  const account: BuyerAccount = {
    displayName: name,
    email: args.email.trim().toLowerCase(),
    onboardedAt: new Date().toISOString(),
    card: { issued: false },
    policy: { ...EMPTY_POLICY },
    rules: [],
    ledger: [],
    addresses: [],
  };

  setBuyerCloudSyncUid(cred.user.uid);
  await setDoc(doc(db, BUYERS, cred.user.uid), {
    ...stripUndefined(account),
    uid: cred.user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  writeBuyerAccount(account);

  return { user: cred.user, account };
}

export async function signInBuyer(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured");

  clearBuyerShopSession();

  const cred = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  setBuyerCloudSyncUid(cred.user.uid);
  const account = await loadBuyerFromCloud(cred.user.uid);
  if (account) {
    writeBuyerAccount(account);
  } else {
    clearBuyerAccount();
  }
  return { user: cred.user, account };
}

export async function signOutBuyer() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
  setBuyerCloudSyncUid(null);
  clearBuyerAccount();
  clearBuyerShopSession();
}

export async function loadBuyerFromCloud(
  uid: string,
): Promise<BuyerAccount | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await getDoc(doc(db, BUYERS, uid));
  if (!snap.exists()) return null;
  return normalizeBuyerAccount(snap.data() as Partial<BuyerAccount>);
}

/** Push local/account state to Firestore for the signed-in user. */
export async function saveBuyerToCloud(
  uid: string,
  account: BuyerAccount,
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  await setDoc(
    doc(db, BUYERS, uid),
    {
      ...stripUndefined(account),
      uid,
      email: account.email ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeAuth(cb: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth || !isFirebaseConfigured()) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export function authErrorMessage(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Sign in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a bit.";
    case "permission-denied":
      return "Firestore blocked the write. Check security rules for buyers/{uid}.";
    default:
      return err instanceof Error ? err.message : "Authentication failed";
  }
}
