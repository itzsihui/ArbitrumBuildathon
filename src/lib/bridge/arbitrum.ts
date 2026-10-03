import {
  EthBridger,
  EthDepositMessageStatus,
  getArbitrumNetwork,
  ParentTransactionReceipt,
} from "@arbitrum/sdk";
import { providers, utils, Wallet } from "ethers";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "@/lib/config";

export type BridgeRole = "buyer" | "facilitator";

export type BridgeWallet = {
  roles: BridgeRole[];
  address: string;
  parentBalanceEth: string;
  childBalanceEth: string;
};

export type DepositStage =
  | "parent_pending"
  | "parent_failed"
  | "child_pending"
  | "deposited";

export type DepositStatus = {
  parentTxHash: string;
  parentTxUrl: string;
  stage: DepositStage;
  parentConfirmations: number;
  amountEth: string | null;
  to: string | null;
  childTxHash: string | null;
  childTxUrl: string | null;
};

type ParentPreset = { label: string; rpcUrl: string; explorerBase: string };

const PARENT_PRESETS: Record<number, ParentPreset> = {
  421614: {
    label: "Ethereum Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorerBase: "https://sepolia.etherscan.io",
  },
  42161: {
    label: "Ethereum",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorerBase: "https://etherscan.io",
  },
};

function parentPreset(): ParentPreset {
  return PARENT_PRESETS[config.chainId] ?? PARENT_PRESETS[421614];
}

export const bridgeConfig = {
  get parentLabel() {
    return parentPreset().label;
  },
  get parentRpcUrl() {
    return process.env.PARENT_RPC_URL?.trim() || parentPreset().rpcUrl;
  },
  get parentExplorerBase() {
    return (
      process.env.PARENT_EXPLORER_BASE?.trim() || parentPreset().explorerBase
    ).replace(/\/$/, "");
  },
  /** Hard cap per deposit so a stray request can't drain the server wallet. */
  get maxDepositEth() {
    const raw = Number(process.env.BRIDGE_MAX_DEPOSIT_ETH);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return config.isTestnet ? 0.05 : 0.005;
  },
};

function parentProvider() {
  return new providers.StaticJsonRpcProvider(bridgeConfig.parentRpcUrl);
}

function childProvider() {
  return new providers.StaticJsonRpcProvider(config.rpcUrl, config.chainId);
}

function keyForRole(role: BridgeRole) {
  return role === "buyer"
    ? config.buyerPrivateKey
    : config.facilitatorPrivateKey;
}

function parentTxUrl(hash: string) {
  return `${bridgeConfig.parentExplorerBase}/tx/${hash}`;
}

function childTxUrl(hash: string) {
  return `${config.explorerBase.replace(/\/$/, "")}/tx/${hash}`;
}

/** Server wallets that need Arbitrum ETH, merged when buyer and relayer share a key. */
export async function getBridgeWallets(): Promise<BridgeWallet[]> {
  const byAddress = new Map<string, BridgeRole[]>();
  for (const role of ["buyer", "facilitator"] as const) {
    const key = keyForRole(role);
    if (!key) continue;
    const address = privateKeyToAccount(key).address;
    byAddress.set(address, [...(byAddress.get(address) ?? []), role]);
  }

  const parent = parentProvider();
  const child = childProvider();
  return Promise.all(
    [...byAddress.entries()].map(async ([address, roles]) => {
      const [parentBalance, childBalance] = await Promise.all([
        parent.getBalance(address),
        child.getBalance(address),
      ]);
      return {
        roles,
        address,
        parentBalanceEth: utils.formatEther(parentBalance),
        childBalanceEth: utils.formatEther(childBalance),
      };
    }),
  );
}

/**
 * Deposit ETH from the parent chain to the same address on Arbitrum via the
 * canonical bridge (Inbox.depositEth). Returns as soon as the parent tx is sent.
 */
export async function depositEth(input: {
  role: BridgeRole;
  amountEth: string;
}): Promise<{ parentTxHash: string; parentTxUrl: string; from: string }> {
  const key = keyForRole(input.role);
  if (!key) {
    throw new Error(
      input.role === "buyer"
        ? "BUYER_PRIVATE_KEY is not set."
        : "FACILITATOR_PRIVATE_KEY (or BUYER_PRIVATE_KEY) is not set.",
    );
  }

  const amountNum = Number(input.amountEth);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error("Amount must be a positive ETH value.");
  }
  if (amountNum > bridgeConfig.maxDepositEth) {
    throw new Error(
      `Amount exceeds the ${bridgeConfig.maxDepositEth} ETH per-deposit cap (BRIDGE_MAX_DEPOSIT_ETH).`,
    );
  }
  const amount = utils.parseEther(input.amountEth);

  const signer = new Wallet(key, parentProvider());
  const parentChainId = await signer.getChainId();
  const network = getArbitrumNetwork(config.chainId);
  if (network.parentChainId !== parentChainId) {
    throw new Error(
      `PARENT_RPC_URL is chain ${parentChainId}, but ${config.chainLabel} settles to chain ${network.parentChainId}.`,
    );
  }

  const balance = await signer.getBalance();
  if (balance.lt(amount)) {
    throw new Error(
      `Insufficient ${bridgeConfig.parentLabel} ETH: have ${utils.formatEther(balance)}, need ${input.amountEth} plus gas.`,
    );
  }

  const bridger = new EthBridger(network);
  const tx = await bridger.deposit({ amount, parentSigner: signer });
  return {
    parentTxHash: tx.hash,
    parentTxUrl: parentTxUrl(tx.hash),
    from: signer.address,
  };
}

/** Track a deposit: parent tx confirmation, then ETH landing on Arbitrum. */
export async function getDepositStatus(
  parentTxHash: string,
): Promise<DepositStatus> {
  const base: DepositStatus = {
    parentTxHash,
    parentTxUrl: parentTxUrl(parentTxHash),
    stage: "parent_pending",
    parentConfirmations: 0,
    amountEth: null,
    to: null,
    childTxHash: null,
    childTxUrl: null,
  };

  const parent = parentProvider();
  const receipt = await parent.getTransactionReceipt(parentTxHash);
  if (!receipt) return base;

  base.parentConfirmations = receipt.confirmations;
  if (receipt.status === 0) return { ...base, stage: "parent_failed" };

  const deposits = await new ParentTransactionReceipt(receipt).getEthDeposits(
    childProvider(),
  );
  const deposit = deposits[0];
  if (!deposit) {
    throw new Error("Transaction is not an Arbitrum ETH deposit.");
  }

  const status = await deposit.status();
  return {
    ...base,
    stage:
      status === EthDepositMessageStatus.DEPOSITED
        ? "deposited"
        : "child_pending",
    amountEth: utils.formatEther(deposit.value),
    to: deposit.to,
    childTxHash: deposit.childTxHash,
    childTxUrl: childTxUrl(deposit.childTxHash),
  };
}
