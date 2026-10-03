import {
  generatePrivateKey,
  privateKeyToAccount,
} from "viem/accounts";
import {
  getAddress,
  isAddress,
  verifyMessage,
  type Hex,
} from "viem";
import { config } from "@/lib/config";

/** Checksummed EVM address (0x…). */
export type HexAddress = `0x${string}`;
/** @deprecated Alias — same as HexAddress after X Layer migration. */
export type ClassicAddress = HexAddress;

export type MerchantAuthProof = {
  address: HexAddress;
  message: string;
  signature: string;
  network: string;
  authenticatedAt: string;
};

type EthereumProvider = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function shortAddress(address: string, chars = 4) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function parseMerchantAddress(
  value: string | null | undefined,
): HexAddress | null {
  const raw = value?.trim();
  if (!raw || !isAddress(raw)) return null;
  try {
    return getAddress(raw);
  } catch {
    return null;
  }
}

function buildAuthMessage(address: HexAddress): string {
  const issuedAt = new Date().toISOString();
  return [
    "Borneo — merchant wallet authentication",
    "",
    "Sign this message to prove you control the payout address for X Layer x402.",
    "This does not move funds or submit an on-chain transaction.",
    "",
    `Address: ${address}`,
    `Network: ${config.network} (X Layer)`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
}

function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export function hasMetaMask(): boolean {
  return Boolean(getProvider());
}

export async function getMetaMaskAccounts(): Promise<HexAddress[]> {
  const provider = getProvider();
  if (!provider) return [];
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  return accounts
    .map((a) => parseMerchantAddress(a))
    .filter((a): a is HexAddress => Boolean(a));
}

export function onMetaMaskAccountsChanged(
  handler: (accounts: HexAddress[]) => void,
): () => void {
  const provider = getProvider();
  if (!provider?.on || !provider.removeListener) return () => undefined;
  const listener = (...args: unknown[]) => {
    const list = (args[0] as string[] | undefined) ?? [];
    handler(
      list
        .map((a) => parseMerchantAddress(a))
        .filter((a): a is HexAddress => Boolean(a)),
    );
  };
  provider.on("accountsChanged", listener);
  return () => provider.removeListener?.("accountsChanged", listener);
}

/**
 * Prove control of an EVM address via MetaMask personal_sign.
 */
export async function authenticateWithMetaMask(): Promise<MerchantAuthProof> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("MetaMask (or another EVM wallet) is not available.");
  }
  const accounts = await getMetaMaskAccounts();
  const address = accounts[0];
  if (!address) throw new Error("No wallet account connected.");
  const message = buildAuthMessage(address);
  const signature = (await provider.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;
  return {
    address,
    message,
    signature,
    network: config.network,
    authenticatedAt: new Date().toISOString(),
  };
}

/**
 * Prove control by signing with a local private key (demo / server tooling).
 * Key stays in the browser; only address + signature are sent to the server.
 */
export async function authenticateWithPrivateKeyAsync(
  privateKey: string,
): Promise<MerchantAuthProof> {
  const key = privateKey.trim().replace(/^["']|["']$/g, "");
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Invalid private key. Use a 32-byte hex key (0x…).");
  }
  const account = privateKeyToAccount(normalized as Hex);
  const address = getAddress(account.address);
  const message = buildAuthMessage(address);
  const signature = await account.signMessage({ message });
  return {
    address,
    message,
    signature,
    network: config.network,
    authenticatedAt: new Date().toISOString(),
  };
}

/** @deprecated Use authenticateWithPrivateKeyAsync */
export const authenticateWithXrplSeed = authenticateWithPrivateKeyAsync;

/** Generate a fresh EVM wallet (show private key once to the merchant). */
export function generateMerchantWallet(): {
  privateKey: Hex;
  seed: Hex;
  address: HexAddress;
} {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    seed: privateKey,
    address: getAddress(account.address),
  };
}

/** Server-side: verify EVM ownership proof before accepting payTo. */
export async function verifyMerchantAuth(
  proof: MerchantAuthProof | null | undefined,
): Promise<HexAddress | null> {
  if (!proof?.address || !proof.message || !proof.signature) {
    return null;
  }
  const address = parseMerchantAddress(proof.address);
  if (!address) return null;
  if (!proof.message.includes(address) && !proof.message.includes(proof.address)) {
    return null;
  }
  const issued = proof.message.match(/Issued at:\s*(\S+)/)?.[1];
  if (issued) {
    const t = Date.parse(issued);
    if (!Number.isFinite(t) || Date.now() - t > 24 * 60 * 60 * 1000) {
      return null;
    }
  }
  try {
    const ok = await verifyMessage({
      address,
      message: proof.message,
      signature: proof.signature as Hex,
    });
    return ok ? address : null;
  } catch {
    return null;
  }
}

/** X Layer Testnet chain params for wallet_addEthereumChain. */
export const XLAYER_TESTNET = {
  chainId: 1952,
  chainIdHex: "0x7a0",
  chainName: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: ["https://testrpc.xlayer.tech/terigon"],
  blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer-test"],
} as const;

export const XLAYER_MAINNET = {
  chainId: 196,
  chainIdHex: "0xc4",
  chainName: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: ["https://rpc.xlayer.tech"],
  blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer"],
} as const;

/** @deprecated Use XLAYER_TESTNET */
export const BASE_SEPOLIA = XLAYER_TESTNET;
/** @deprecated Use XLAYER_TESTNET */
export const FUJI = XLAYER_TESTNET;
