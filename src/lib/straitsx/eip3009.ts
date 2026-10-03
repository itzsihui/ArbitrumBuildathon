import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export type CardApiAccept = {
  scheme: string;
  network: string;
  amount: string;
  asset: `0x${string}`;
  payTo: `0x${string}`;
  maxTimeoutSeconds: number;
  chainId?: number;
  extra?: { name?: string; version?: string; assetTransferMethod?: string };
};

/** EIP-3009 authorization for StraitsX cardapi x402 (Fuji sandbox). */
export async function buildEip3009PaymentSignature(args: {
  privateKey: `0x${string}`;
  accept: CardApiAccept;
  x402Version?: number;
}) {
  const account = privateKeyToAccount(args.privateKey);
  const chainId = args.accept.chainId ?? 43113;
  const validAfter = BigInt(0);
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000) + (args.accept.maxTimeoutSeconds || 300),
  );
  const nonce =
    `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}` as Hex;

  const message = {
    from: account.address,
    to: args.accept.payTo,
    value: BigInt(args.accept.amount),
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await account.signTypedData({
    domain: {
      name: args.accept.extra?.name || "XSGD",
      version: args.accept.extra?.version || "2",
      chainId,
      verifyingContract: args.accept.asset,
    },
    types: transferWithAuthorizationTypes,
    primaryType: "TransferWithAuthorization",
    message,
  });

  const payload = {
    x402Version: args.x402Version ?? 1,
    scheme: "exact",
    network: args.accept.network,
    accepted: {
      scheme: args.accept.scheme,
      network: args.accept.network,
      amount: args.accept.amount,
      asset: args.accept.asset,
      payTo: args.accept.payTo,
      maxTimeoutSeconds: args.accept.maxTimeoutSeconds,
      ...(args.accept.chainId ? { chainId: args.accept.chainId } : {}),
      ...(args.accept.extra ? { extra: args.accept.extra } : {}),
    },
    payload: {
      signature,
      authorization: {
        from: message.from,
        to: message.to,
        value: args.accept.amount,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  return {
    header: Buffer.from(JSON.stringify(payload)).toString("base64"),
    from: account.address,
  };
}
