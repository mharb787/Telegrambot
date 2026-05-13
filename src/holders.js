const SOLANA_RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com"
];

export async function analyzeHolders(snapshot) {
  if (snapshot.chainId !== "solana") {
    return {
      available: false,
      reason: "holder analysis currently supports solana only"
    };
  }

  const holderData = await getSolanaHolderData(snapshot.tokenAddress);
  const largest = holderData.largest;
  if (!largest.length) {
    return {
      available: false,
      reason: "largest holder data unavailable"
    };
  }

  const totalSupply = holderData.totalSupply || 1_000_000_000;
  const poolTokenAmount = Number(snapshot.poolBaseAmount || 0);
  const top = largest[0];
  const topAmount = Number(top.amount || 0);
  const topPct = totalSupply > 0 ? topAmount / totalSupply * 100 : 0;
  const poolPct = totalSupply > 0 ? poolTokenAmount / totalSupply * 100 : 0;
  const topLooksLikePool = poolTokenAmount > 0 && Math.abs(topAmount - poolTokenAmount) / poolTokenAmount < 0.05;
  const topNonPool = topLooksLikePool ? largest[1] : top;
  const topNonPoolAmount = Number(topNonPool?.amount || 0);
  const topNonPoolPct = totalSupply > 0 ? topNonPoolAmount / totalSupply * 100 : 0;

  return {
    available: true,
    totalSupply,
    largestAccount: top.address,
    largestPct: round(topPct),
    poolPct: round(poolPct),
    largestLooksLikePool: topLooksLikePool,
    largestNonPoolAccount: topNonPool?.address || null,
    largestNonPoolPct: round(topNonPoolPct),
    concentrationRisk: classifyConcentration(topNonPoolPct)
  };
}

function classifyConcentration(percent) {
  if (percent >= 50) return "critical";
  if (percent >= 20) return "high";
  if (percent >= 10) return "medium";
  if (percent >= 5) return "watch";
  return "low";
}

async function getSolanaHolderData(mint) {
  const body = JSON.stringify([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenLargestAccounts",
      params: [mint]
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "getTokenSupply",
      params: [mint]
    }
  ]);

  for (const url of SOLANA_RPC_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "token-watch-bot/0.1"
        },
        body,
        signal: controller.signal
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const largestPayload = Array.isArray(payload) ? payload.find((item) => item.id === 1) : payload;
      const supplyPayload = Array.isArray(payload) ? payload.find((item) => item.id === 2) : null;
      const accounts = largestPayload?.result?.value || [];
      return {
        largest: accounts.map((account) => ({
        address: account.address,
        amount: Number(account.uiAmount ?? account.amount ?? 0)
        })),
        totalSupply: Number(supplyPayload?.result?.value?.uiAmount || 0)
      };
    } catch {
      // Try the next public RPC endpoint.
    } finally {
      clearTimeout(timeout);
    }
  }

  return { largest: [], totalSupply: 0 };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
