/**
 * Verify a Firebase ID token via Identity Toolkit (no firebase-admin).
 * Returns the local uid or null.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<{ uid: string } | null> {
  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    process.env.FIREBASE_API_KEY?.trim();
  if (!apiKey || !idToken.trim()) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: idToken.trim() }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{ localId?: string }>;
    };
    const uid = data.users?.[0]?.localId;
    return uid ? { uid } : null;
  } catch {
    return null;
  }
}

/** Extract Bearer token from Authorization header. */
export function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}
