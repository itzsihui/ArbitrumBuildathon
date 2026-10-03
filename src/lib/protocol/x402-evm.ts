import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseSignature,
  toHex,
  type Hex,
  type LocalAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/** x402 v2 wire types (`exact` scheme, EIP-3009 on EVM). */
export type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown> & { name?: string; version?: string };
};

export type PaymentRequired = {
  x402Version: 2;
  resource: { url: string; description: string; mimeType: string };
  accepts: PaymentRequirements[];
  error?: string;
};

export type Eip3009Authorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
};

export type PaymentPayload = {
  x402Version: 2;
  resource?: PaymentRequired["resource"];
  accepted: PaymentRequirements;
  payload: { authorization: Eip3009Authorization; signature: Hex };
};

export type VerifyResult =
  | { isValid: true; payer: string }
  | { isValid: false; invalidReason: string; payer?: string };

export type SettleResult =
  | { success: true; transaction: Hex; payer: string }
  | { success: false; errorReason: string; transaction?: Hex; payer?: string };

const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const eip3009Abi = [
  {
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function chainIdOf(network: string): number {
  const id = Number(network.startsWith("eip155:") ? network.slice(7) : NaN);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Unsupported network: ${network} (expected eip155:CHAIN_ID)`);
  }
  return id;
}

function chainFor(network: string) {
  const id = chainIdOf(network);
  if (id === arbitrum.id) return arbitrum;
  if (id === arbitrumSepolia.id) return arbitrumSepolia;
  throw new Error(`Unsupported network: ${network} (Arbitrum One or Sepolia only)`);
}

function typedData(requirements: PaymentRequirements, auth: Eip3009Authorization) {
  const name = requirements.extra?.name;
  const version = requirements.extra?.version;
  if (!name || !version) {
    throw new Error("Payment requirements are missing the EIP-712 domain (extra.name / extra.version)");
  }
  return {
    domain: {
      name,
      version,
      chainId: chainIdOf(requirements.network),
      verifyingContract: getAddress(requirements.asset),
    },
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from: getAddress(auth.from),
      to: getAddress(auth.to),
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce,
    },
  };
}

function base64Encode(text: string) {
  return Buffer.from(text, "utf8").toString("base64");
}

function base64Decode(text: string) {
  return Buffer.from(text, "base64").toString("utf8");
}

export function encodePaymentRequiredHeader(body: PaymentRequired) {
  return base64Encode(JSON.stringify(body));
}

export function encodePaymentSignatureHeader(payload: PaymentPayload) {
  return base64Encode(JSON.stringify(payload));
}

export function decodePaymentSignatureHeader(header: string): PaymentPayload {
  const decoded = JSON.parse(base64Decode(header.trim())) as PaymentPayload;
  if (
    decoded?.x402Version !== 2 ||
    !decoded.accepted ||
    !decoded.payload?.authorization ||
    !decoded.payload.signature
  ) {
    throw new Error("Invalid PAYMENT-SIGNATURE payload");
  }
  return decoded;
}

/** Buyer side: sign an EIP-3009 authorization for the first accepted requirement. */
export async function createPaymentPayload(
  account: LocalAccount,
  challenge: PaymentRequired,
): Promise<PaymentPayload> {
  const accepted = challenge.accepts?.[0];
  if (!accepted || accepted.scheme !== "exact") {
    throw new Error("No `exact` payment requirement in 402 challenge");
  }
  const now = Math.floor(Date.now() / 1000);
  const authorization: Eip3009Authorization = {
    from: account.address,
    to: getAddress(accepted.payTo),
    value: accepted.amount,
    validAfter: String(now - 5),
    validBefore: String(now + accepted.maxTimeoutSeconds),
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
  };
  const signature = await account.signTypedData(typedData(accepted, authorization));
  return {
    x402Version: 2,
    resource: challenge.resource,
    accepted,
    payload: { authorization, signature },
  };
}

/**
 * Facilitator for x402 `exact` payments on Arbitrum: verifies EIP-3009
 * authorizations and relays `transferWithAuthorization` (relayer pays gas).
 */
export class ArbitrumFacilitator {
  private readonly publicClient;
  private readonly walletClient;

  constructor(opts: { relayerKey: Hex; network: string; rpcUrl: string }) {
    const chain = chainFor(opts.network);
    const transport = http(opts.rpcUrl);
    this.publicClient = createPublicClient({ chain, transport });
    this.walletClient = createWalletClient({
      account: privateKeyToAccount(opts.relayerKey),
      chain,
      transport,
    });
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResult> {
    const auth = payload.payload.authorization;
    const payer = auth.from;
    const fail = (invalidReason: string): VerifyResult => ({
      isValid: false,
      invalidReason,
      payer,
    });

    if (payload.accepted.scheme !== "exact" || requirements.scheme !== "exact") {
      return fail("invalid_scheme");
    }
    if (payload.accepted.network !== requirements.network) {
      return fail("network_mismatch");
    }
    if (getAddress(auth.to) !== getAddress(requirements.payTo)) {
      return fail("recipient_mismatch");
    }
    if (BigInt(auth.value) !== BigInt(requirements.amount)) {
      return fail("amount_mismatch");
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (BigInt(auth.validBefore) < now + 6n) return fail("authorization_expired");
    if (BigInt(auth.validAfter) > now) return fail("authorization_not_yet_valid");

    let signatureOk = false;
    try {
      signatureOk = await this.publicClient.verifyTypedData({
        address: getAddress(payer),
        ...typedData(requirements, auth),
        signature: payload.payload.signature,
      });
    } catch {
      signatureOk = false;
    }
    if (!signatureOk) return fail("invalid_signature");

    const asset = getAddress(requirements.asset);
    const [used, balance] = await Promise.all([
      this.publicClient.readContract({
        address: asset,
        abi: eip3009Abi,
        functionName: "authorizationState",
        args: [getAddress(payer), auth.nonce],
      }),
      this.publicClient.readContract({
        address: asset,
        abi: eip3009Abi,
        functionName: "balanceOf",
        args: [getAddress(payer)],
      }),
    ]);
    if (used) return fail("nonce_already_used");
    if (balance < BigInt(requirements.amount)) return fail("insufficient_balance");

    return { isValid: true, payer };
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResult> {
    const verified = await this.verify(payload, requirements);
    if (!verified.isValid) {
      return {
        success: false,
        errorReason: verified.invalidReason,
        payer: verified.payer,
      };
    }
    const auth = payload.payload.authorization;
    try {
      const { r, s, v, yParity } = parseSignature(payload.payload.signature);
      const hash = await this.walletClient.writeContract({
        address: getAddress(requirements.asset),
        abi: eip3009Abi,
        functionName: "transferWithAuthorization",
        args: [
          getAddress(auth.from),
          getAddress(auth.to),
          BigInt(auth.value),
          BigInt(auth.validAfter),
          BigInt(auth.validBefore),
          auth.nonce,
          Number(v ?? BigInt(yParity + 27)),
          r,
          s,
        ],
      });
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        return {
          success: false,
          errorReason: "transaction_reverted",
          transaction: hash,
          payer: auth.from,
        };
      }
      return { success: true, transaction: hash, payer: auth.from };
    } catch (error) {
      return {
        success: false,
        errorReason:
          error instanceof Error ? error.message.split("\n")[0] : "transaction_failed",
        payer: auth.from,
      };
    }
  }
}
