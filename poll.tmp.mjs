import { createPublicClient, http, formatEther, formatUnits, parseAbi } from "viem";
import { arbitrumSepolia } from "viem/chains";
const a = "0x288B8BEd30840d3412d24Bc063391a4Bb1D6AAC3";
const c = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });
const abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
for (let i = 0; i < 80; i++) {
  try {
    const [e,u] = await Promise.all([c.getBalance({address:a}), c.readContract({address:"0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",abi,functionName:"balanceOf",args:[a]})]);
    console.log(new Date().toLocaleTimeString(), `ETH ${formatEther(e)} | USDC ${formatUnits(u,6)}`);
    if (e > 0n) { console.log("ETH_ARRIVED"); if (u > 0n) { console.log("READY"); break; } }
  } catch { console.log("rpc hiccup"); }
  await new Promise(r => setTimeout(r, 15000));
}
