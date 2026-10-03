/**
 * End-to-end x402 purchase against a running Borneo server.
 *   npx tsx --env-file=.env scripts/e2e-checkout.mts [baseUrl] [slug] [skuId]
 * Signs the 402 challenge with BUYER_PRIVATE_KEY and pays. With CHECKOUT_ADDRESS
 * set on the server, settlement goes through BorneoCheckout.
 */
import { privateKeyToAccount } from "viem/accounts";
import {
  createPaymentPayload,
  encodePaymentSignatureHeader,
  type PaymentRequired,
} from "../src/lib/protocol/x402-evm.ts";

const [base = "http://localhost:3123", slug = "atelier-tee", skuId] = process.argv.slice(2);
const raw = process.env.BUYER_PRIVATE_KEY?.trim();
if (!raw) throw new Error("BUYER_PRIVATE_KEY missing");
const account = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`);

const url = `${base}/s/${slug}/buy`;
const body = JSON.stringify({ skuId, quantity: 1, orderId: crypto.randomUUID() });
const headers = { "content-type": "application/json" };

const first = await fetch(url, { method: "POST", headers, body });
if (first.status !== 402) throw new Error(`expected 402, got ${first.status}: ${await first.text()}`);
const challenge = JSON.parse(
  Buffer.from(first.headers.get("PAYMENT-REQUIRED")!, "base64").toString("utf8"),
) as PaymentRequired;
const accepted = challenge.accepts[0];
console.log("402 challenge:", {
  amount: accepted.amount,
  asset: accepted.asset,
  payTo: accepted.payTo,
  primaryType: accepted.extra?.primaryType ?? "TransferWithAuthorization",
  merchant: accepted.extra?.merchant,
  nonce: accepted.extra?.nonce,
});

const payload = await createPaymentPayload(account, challenge);
const paid = await fetch(url, {
  method: "POST",
  headers: { ...headers, "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) },
  body,
});
const receipt = await paid.json();
console.log(paid.status, JSON.stringify(receipt, null, 2));
if (paid.status !== 200) process.exit(1);
