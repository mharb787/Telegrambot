export function snapshotFromPair(pair, profile) {
  return {
    at: new Date().toISOString(),
    chainId: pair.chainId,
    tokenAddress: pair.baseToken?.address || profile.tokenAddress,
    pairAddress: pair.pairAddress,
    name: pair.baseToken?.name || "Unknown",
    symbol: pair.baseToken?.symbol || "UNKNOWN",
    dexId: pair.dexId,
    url: pair.url || profile.profileUrl,
    priceUsd: number(pair.priceUsd),
    liquidityUsd: number(pair.liquidity?.usd),
    fdv: number(pair.fdv),
    marketCap: number(pair.marketCap),
    volume5m: number(pair.volume?.m5),
    volume1h: number(pair.volume?.h1),
    volume6h: number(pair.volume?.h6),
    volume24h: number(pair.volume?.h24),
    priceChange5m: number(pair.priceChange?.m5),
    priceChange1h: number(pair.priceChange?.h1),
    priceChange6h: number(pair.priceChange?.h6),
    priceChange24h: number(pair.priceChange?.h24),
    buys1h: number(pair.txns?.h1?.buys),
    sells1h: number(pair.txns?.h1?.sells),
    pairCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
    socialLinks: countSocialLinks(pair, profile),
    boostActive: number(pair.boosts?.active) + number(profile.boostAmount),
    boostTotalAmount: number(profile.boostTotalAmount)
  };
}

export function scoreToken(snapshot, history) {
  const ageHours = snapshot.pairCreatedAt
    ? Math.max(0.1, (Date.now() - Date.parse(snapshot.pairCreatedAt)) / 3_600_000)
    : 999;
  const previous = history.length >= 2 ? history[history.length - 2] : null;
  const liquidityGrowth = growth(previous?.liquidityUsd, snapshot.liquidityUsd);
  const marketGrowth = growth(previous?.marketCap || previous?.fdv, snapshot.marketCap || snapshot.fdv);
  const buyRatio = ratio(snapshot.buys1h, snapshot.sells1h);
  const volumeLiquidity = snapshot.liquidityUsd > 0 ? snapshot.volume1h / snapshot.liquidityUsd : 0;

  const liquidityScore = clamp(logScore(snapshot.liquidityUsd, 5_000, 250_000), 0, 25);
  const volumeScore = clamp(logScore(snapshot.volume1h, 2_500, 500_000), 0, 20);
  const flowScore = clamp((buyRatio - 0.45) * 45, 0, 15);
  const growthScore = clamp(liquidityGrowth * 12 + marketGrowth * 8 + positive(snapshot.priceChange1h) / 4, 0, 20);
  const ageScore = ageHours <= 1 ? 5 : ageHours <= 48 ? 15 : 10;
  const socialScore = clamp(snapshot.socialLinks * 5 + snapshot.boostActive * 3, 0, 15);

  const survivalScore = clamp(liquidityScore + volumeScore + flowScore + growthScore + ageScore + socialScore, 0, 100);
  const exchangePotential = clamp(
    logScore(snapshot.liquidityUsd, 50_000, 1_000_000) +
    logScore(snapshot.volume24h, 100_000, 5_000_000) +
    logScore(snapshot.marketCap || snapshot.fdv, 500_000, 20_000_000) +
    flowScore +
    socialScore,
    0,
    100
  );

  const fdvLiquidity = snapshot.liquidityUsd > 0 ? (snapshot.fdv || snapshot.marketCap || 0) / snapshot.liquidityUsd : 999;
  const rugRisk = clamp(
    (snapshot.liquidityUsd < 10_000 ? 25 : 0) +
    (snapshot.sells1h > snapshot.buys1h * 1.6 ? 25 : 0) +
    (fdvLiquidity > 80 ? 20 : fdvLiquidity > 40 ? 10 : 0) +
    (ageHours < 2 ? 10 : 0) +
    (volumeLiquidity > 5 ? 10 : 0) -
    Math.min(socialScore, 10),
    0,
    100
  );

  return {
    survivalScore: Math.round(survivalScore),
    exchangePotential: Math.round(exchangePotential),
    rugRisk: Math.round(rugRisk),
    hypeScore: Math.round(socialScore),
    liquidityGrowth: round(liquidityGrowth),
    marketGrowth: round(marketGrowth),
    buyRatio: round(buyRatio),
    ageHours: round(ageHours),
    classification: classify(survivalScore, exchangePotential, rugRisk)
  };
}

export function shouldAlert(snapshot, scores, config) {
  if (snapshot.liquidityUsd < config.minLiquidityUsd) return false;
  if (snapshot.volume1h < config.minVolume1hUsd) return false;
  if (scores.rugRisk > config.rugRiskMax) return false;
  return scores.survivalScore >= config.alertScoreMin || scores.exchangePotential >= config.alertScoreMin;
}

function classify(survival, exchange, risk) {
  if (risk >= 70) return "High risk / likely dead";
  if (exchange >= 75 && survival >= 70) return "Exchange candidate";
  if (survival >= 70) return "Organic growth";
  if (survival >= 55) return "Short-term hype";
  return "Weak / watch only";
}

function countSocialLinks(pair, profile) {
  return new Set([
    ...(pair.info?.socials || []).map((item) => item.platform || item.type || item.url),
    ...(pair.info?.websites || []).map((item) => item.url),
    ...(profile.links || []).map((item) => item.type || item.label || item.url)
  ].filter(Boolean)).size;
}

function growth(previous, current) {
  previous = number(previous);
  current = number(current);
  if (previous <= 0 || current <= 0) return 0;
  return (current - previous) / previous;
}

function logScore(value, min, max) {
  value = number(value);
  if (value <= min) return 0;
  return Math.log(value / min) / Math.log(max / min) * 25;
}

function ratio(buys, sells) {
  const total = number(buys) + number(sells);
  return total ? number(buys) / total : 0.5;
}

function positive(value) {
  return Math.max(0, number(value));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
