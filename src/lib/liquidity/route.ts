import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import {
  config,
  explorerTx,
  toAtomic,
  USDC_ARBITRUM_ONE,
} from "@/lib/config";

/** Uniswap V3 on Arbitrum One. */
const UNISWAP = {
  quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  swapRouter02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  /** Fee tiers tried in order (0.05%, 0.3%). */
  fees: [500, 3000],
} as const;

const ARBITRUM_ONE_RPC = "https://arb1.arbitrum.io/rpc";
/** Overpay buffer on the ETH input so the swap still clears small price moves. */
const SLIPPAGE_BPS = 50n;

const ERC20_BALANCE_OF = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactOutputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountIn", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export type WalletBalances = {
  address: string;
  tokenAtomic: string;
  tokenHuman: string;
  nativeWei: string;
  nativeHuman: string;
  hasEnoughToken: boolean;
  shortfallAtomic: string;
};

export type LiquidityQuote = {
  /**
   * live: executable on the settle chain (Arbitrum One).
   * plan: text plan only (no usable DEX route).
   * mainnet-preview: real Uniswap quote from Arbitrum One, never executed.
   */
  mode: "live" | "plan" | "mainnet-preview";
  /** Human label of which network this quote is from. */
  networkLabel?: string;
  chainId: number;
  fromSymbol: string;
  toSymbol: string;
  fromAmountHuman: string;
  /** Exact native wei the swap would spend (incl. slippage buffer). */
  fromAmountWei?: string;
  toAmountHuman: string;
  toAmountAtomic: string;
  toTokenAddress: string;
  fee?: number;
  routeSummary: string;
  /** Display pool pair e.g. ETH/USDC */
  poolLabel?: string;
  hops?: string[];
};

export type LiquidityRouteResult = {
  needed: boolean;
  balances: WalletBalances | null;
  quote: LiquidityQuote | null;
  swapTxHash?: string;
  explorerUrl?: string;
  executed: boolean;
  message: string;
};

function settleChain() {
  return config.chainId === arbitrum.id ? arbitrum : arbitrumSepolia;
}

function settleClient() {
  return createPublicClient({
    chain: settleChain(),
    transport: http(config.rpcUrl),
  });
}

function arbitrumOneClient() {
  return createPublicClient({
    chain: arbitrum,
    transport: http(
      config.chainId === arbitrum.id ? config.rpcUrl : ARBITRUM_ONE_RPC,
    ),
  });
}

export async function readBuyerBalances(
  neededAtomic: string,
  address?: `0x${string}`,
  tokenAddress: string = config.tokenAddress,
): Promise<WalletBalances | null> {
  const buyerKey = config.buyerPrivateKey;
  if (!buyerKey && !address) return null;
  const account = address
    ? { address }
    : privateKeyToAccount(buyerKey!);
  const client = settleClient();
  const [nativeWei, tokenBal] = await Promise.all([
    client.getBalance({ address: account.address }),
    client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_BALANCE_OF,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);
  const need = BigInt(neededAtomic);
  const shortfall = need > tokenBal ? need - tokenBal : 0n;
  return {
    address: account.address,
    tokenAtomic: tokenBal.toString(),
    tokenHuman: formatUnits(tokenBal, config.tokenDecimals),
    nativeWei: nativeWei.toString(),
    nativeHuman: formatEther(nativeWei),
    hasEnoughToken: tokenBal >= need,
    shortfallAtomic: shortfall.toString(),
  };
}

function planQuote(
  amountAtomic: bigint,
  toTokenAddress: string,
  toSymbol: string,
): LiquidityQuote {
  const native = config.nativeSymbol;
  const poolLabel = `${native}/${toSymbol}`;
  return {
    mode: "plan",
    chainId: config.chainId,
    fromSymbol: native,
    toSymbol,
    fromAmountHuman: "?",
    toAmountHuman: formatUnits(amountAtomic, config.tokenDecimals),
    toAmountAtomic: amountAtomic.toString(),
    toTokenAddress,
    poolLabel,
    hops: [`${native} → ${toSymbol} (Uniswap V3 · plan)`],
    routeSummary: `Plan: ${native} → ${toSymbol} on ${config.chainLabel} via Uniswap V3 [${poolLabel}]`,
  };
}

/**
 * Uniswap V3 QuoterV2 on Arbitrum One: ETH needed to receive `amountOut` of
 * `tokenOut`, trying each fee tier and keeping the cheapest.
 */
async function quoteEthForExactOut(tokenOut: string, amountOut: bigint) {
  const client = arbitrumOneClient();
  let best: { amountIn: bigint; fee: number } | null = null;
  for (const fee of UNISWAP.fees) {
    try {
      const { result } = await client.simulateContract({
        address: UNISWAP.quoterV2,
        abi: QUOTER_ABI,
        functionName: "quoteExactOutputSingle",
        args: [
          {
            tokenIn: UNISWAP.weth,
            tokenOut: getAddress(tokenOut),
            amount: amountOut,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const amountIn = result[0];
      if (!best || amountIn < best.amountIn) best = { amountIn, fee };
    } catch {
      // Pool missing for this fee tier.
    }
  }
  return best;
}

export async function quoteNativeToToken(
  amountAtomic: bigint,
  toTokenAddress = config.tokenAddress,
  toSymbol = config.tokenSymbol,
): Promise<LiquidityQuote> {
  const fallback = planQuote(amountAtomic, toTokenAddress, toSymbol);
  const preview = config.isTestnet;
  const quoteToken = preview ? USDC_ARBITRUM_ONE : toTokenAddress;
  const best = await quoteEthForExactOut(quoteToken, amountAtomic);
  if (!best) return fallback;

  const native = config.nativeSymbol;
  const withSlippage = (best.amountIn * (10_000n + SLIPPAGE_BPS)) / 10_000n;
  const poolLabel = `${native}/${toSymbol} ${best.fee / 10_000}%`;
  return {
    mode: preview ? "mainnet-preview" : "live",
    networkLabel: preview ? "Arbitrum One (42161), quote only" : config.chainLabel,
    chainId: arbitrum.id,
    fromSymbol: native,
    toSymbol,
    fromAmountHuman: formatEther(withSlippage),
    fromAmountWei: withSlippage.toString(),
    toAmountHuman: formatUnits(amountAtomic, config.tokenDecimals),
    toAmountAtomic: amountAtomic.toString(),
    toTokenAddress: quoteToken,
    fee: best.fee,
    poolLabel,
    hops: [`${native} → ${toSymbol} via Uniswap V3 (${best.fee / 10_000}% pool)`],
    routeSummary: preview
      ? `Live Uniswap V3 quote on Arbitrum One (quote only): ${native} → ${toSymbol} [${poolLabel}]. Settlement runs on ${config.chainLabel}.`
      : `${native} → ${toSymbol} via Uniswap V3 [${poolLabel}]`,
  };
}

export async function executeNativeToTokenSwap(
  quote: LiquidityQuote,
  walletAddress: `0x${string}`,
): Promise<{ txHash?: string; error?: string }> {
  const buyerKey = config.buyerPrivateKey;
  if (!buyerKey) {
    return { error: "BUYER_PRIVATE_KEY missing — cannot execute swap" };
  }
  if (quote.mode === "mainnet-preview") {
    return {
      error: `Mainnet preview is quote only. Fund ${config.tokenSymbol} on ${config.chainLabel} (Circle faucet) to continue.`,
    };
  }
  if (quote.mode !== "live" || !quote.fromAmountWei || !quote.fee) {
    return { error: `Live DEX quote unavailable. Fund ${config.tokenSymbol} or retry.` };
  }
  try {
    const wallet = createWalletClient({
      account: privateKeyToAccount(buyerKey),
      chain: arbitrum,
      transport: http(config.rpcUrl),
    });
    const hash = await wallet.writeContract({
      address: UNISWAP.swapRouter02,
      abi: SWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: UNISWAP.weth,
          tokenOut: getAddress(quote.toTokenAddress),
          fee: quote.fee,
          recipient: walletAddress,
          amountIn: BigInt(quote.fromAmountWei),
          amountOutMinimum: BigInt(quote.toAmountAtomic),
          sqrtPriceLimitX96: 0n,
        },
      ],
      value: BigInt(quote.fromAmountWei),
    });
    await settleClient().waitForTransactionReceipt({ hash });
    return { txHash: hash };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message.split("\n")[0] : "swap broadcast failed",
    };
  }
}

/**
 * Ensure the buyer wallet can cover `price` of settle token on Arbitrum.
 * Fail-soft: returns a plan quote when DEX liquidity / keys are missing.
 * Pass toTokenAddress/toSymbol for full multi-asset settle (defaults to config token).
 */
export async function ensureSettleLiquidity(args: {
  price: string;
  quantity?: number;
  /** When true, attempt broadcast if live quote exists. */
  execute?: boolean;
  toTokenAddress?: string;
  toSymbol?: string;
}): Promise<LiquidityRouteResult> {
  const quantity = Math.max(1, args.quantity ?? 1);
  const toTokenAddress = (args.toTokenAddress || config.tokenAddress).trim();
  const toSymbol = (args.toSymbol || config.tokenSymbol).trim();
  let neededAtomic: bigint;
  try {
    neededAtomic = BigInt(toAtomic(args.price)) * BigInt(quantity);
  } catch {
    return {
      needed: false,
      balances: null,
      quote: null,
      executed: false,
      message: `Invalid price: ${args.price}`,
    };
  }

  const balances = await readBuyerBalances(
    neededAtomic.toString(),
    undefined,
    toTokenAddress,
  );
  if (!balances) {
    return {
      needed: true,
      balances: null,
      quote: null,
      executed: false,
      message: `No buyer wallet — set BUYER_PRIVATE_KEY to route liquidity on ${config.chainLabel}`,
    };
  }

  if (balances.hasEnoughToken) {
    // Balance covers the purchase. On testnet still surface the live Arbitrum
    // One quote so the DEX integration is visible (never executed).
    const preview = config.dexMainnetPreview
      ? await quoteNativeToToken(neededAtomic, toTokenAddress, toSymbol)
      : null;
    return {
      needed: false,
      balances,
      quote: preview,
      executed: false,
      message: preview
        ? `${toSymbol} balance ${balances.tokenHuman} covers purchase, so no swap is needed. ${preview.routeSummary}`
        : `${toSymbol} balance ${balances.tokenHuman} covers purchase`,
    };
  }

  const shortfall = BigInt(balances.shortfallAtomic);
  const quote = await quoteNativeToToken(shortfall, toTokenAddress, toSymbol);
  if (!args.execute) {
    return {
      needed: true,
      balances,
      quote,
      executed: false,
      message: `Need ${formatUnits(shortfall, config.tokenDecimals)} more ${toSymbol}. ${quote.routeSummary}`,
    };
  }

  const exec = await executeNativeToTokenSwap(
    quote,
    balances.address as `0x${string}`,
  );
  if (exec.txHash) {
    return {
      needed: true,
      balances,
      quote,
      swapTxHash: exec.txHash,
      explorerUrl: explorerTx(exec.txHash),
      executed: true,
      message: `Routed liquidity: ${quote.routeSummary}`,
    };
  }

  return {
    needed: true,
    balances,
    quote,
    executed: false,
    message:
      exec.error ||
      `Could not auto-swap — fund ${toSymbol} or retry. ${quote.routeSummary}`,
  };
}
