const API = "https://api.dexscreener.com";

export async function discoverTokens(config) {
  if (config.demoMode) return demoProfiles(config.chains);

  const [profiles, boosts] = await Promise.all([
    getJson(`${API}/token-profiles/latest/v1`),
    getJson(`${API}/token-boosts/latest/v1`)
  ]);

  const byToken = new Map();
  for (const item of [...asArray(profiles), ...asArray(boosts)]) {
    if (!config.chains.includes(item.chainId)) continue;
    const key = `${item.chainId}:${String(item.tokenAddress).toLowerCase()}`;
    byToken.set(key, {
      chainId: item.chainId,
      tokenAddress: item.tokenAddress,
      profileUrl: item.url,
      icon: item.icon,
      header: item.header,
      description: item.description,
      links: item.links || [],
      boostAmount: Number(item.amount || 0),
      boostTotalAmount: Number(item.totalAmount || 0)
    });
  }

  return [...byToken.values()];
}

export async function fetchTokenPairs(chainId, addresses, config) {
  if (config.demoMode) return demoPairs(chainId, addresses);
  if (!addresses.length) return [];

  const chunks = [];
  for (let index = 0; index < addresses.length; index += 30) {
    chunks.push(addresses.slice(index, index + 30));
  }

  const responses = await Promise.all(chunks.map((chunk) => {
    return getJson(`${API}/tokens/v1/${chainId}/${chunk.join(",")}`);
  }));

  return responses.flatMap(asArray);
}

export function pickBestPair(pairs, maxPairAgeHours) {
  const cutoff = Date.now() - maxPairAgeHours * 60 * 60_000;
  const candidates = pairs
    .filter((pair) => Number(pair.pairCreatedAt || 0) >= cutoff)
    .sort((a, b) => Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0));

  return candidates[0] || null;
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "token-watch-bot/0.1" }
  });
  if (!response.ok) throw new Error(`DexScreener ${response.status} for ${url}`);
  return response.json();
}

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function demoProfiles(chains) {
  return chains.map((chainId, index) => ({
    chainId,
    tokenAddress: chainId === "solana"
      ? "DemoSo111111111111111111111111111111111111111"
      : "0x000000000000000000000000000000000000dEAD",
    profileUrl: "https://dexscreener.com",
    description: "Demo token for local bot test",
    links: [
      { type: "twitter", url: "https://x.com/demo" },
      { type: "telegram", url: "https://t.me/demo" }
    ],
    boostAmount: index + 1,
    boostTotalAmount: (index + 1) * 10
  }));
}

function demoPairs(chainId, addresses) {
  return addresses.map((address, index) => ({
    chainId,
    dexId: chainId === "solana" ? "raydium" : "uniswap",
    url: "https://dexscreener.com",
    pairAddress: `${address}-pair`,
    baseToken: { address, name: `Demo ${chainId}`, symbol: chainId === "solana" ? "DSOL" : "DETH" },
    quoteToken: { symbol: chainId === "solana" ? "SOL" : "WETH" },
    priceUsd: String(0.00012 + index / 100000),
    txns: { m5: { buys: 14, sells: 7 }, h1: { buys: 120, sells: 63 }, h24: { buys: 900, sells: 520 } },
    volume: { m5: 1800, h1: 32000, h6: 110000, h24: 440000 },
    priceChange: { m5: 2.5, h1: 18, h6: 62, h24: 145 },
    liquidity: { usd: 52000 + index * 5000 },
    fdv: 740000 + index * 100000,
    marketCap: 510000 + index * 100000,
    pairCreatedAt: Date.now() - 8 * 60 * 60_000,
    info: {
      socials: [{ platform: "twitter" }, { platform: "telegram" }],
      websites: [{ url: "https://example.com" }]
    },
    boosts: { active: 1 }
  }));
}
