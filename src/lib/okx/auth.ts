import { createHmac } from "node:crypto";
import { config } from "@/lib/config";

/** OKX Web3 REST auth headers (HMAC-SHA256, base64). */
export function okxAuthHeaders(
  method: "GET" | "POST",
  requestPath: string,
  body = "",
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  const sign = createHmac("sha256", config.okxSecretKey)
    .update(prehash)
    .digest("base64");
  return {
    "OK-ACCESS-KEY": config.okxApiKey,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": config.okxPassphrase,
    "Content-Type": "application/json",
  };
}

export function hasOkxDexCredentials() {
  return Boolean(
    config.okxApiKey && config.okxSecretKey && config.okxPassphrase,
  );
}
