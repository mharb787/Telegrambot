import { getConfig } from "./config.js";
import { discoverTokens, fetchTokenPairs, pickBestPair } from "./dexscreener.js";
import { scoreToken, shouldAlert, snapshotFromPair } from "./metrics.js";
import { createStore } from "./store.js";
import { writeChart } from "./chart.js";
import { sendTelegramAlert } from "./telegram.js";

const config = getConfig();
const store = await createStore(config.dataDir);

console.log(`Token watch bot started for ${config.chains.join(", ")}.`);

do {
  await scanOnce().catch((error) => {
    console.error(error.stack || error.message);
  });
  if (config.runOnce) break;
  await sleep(config.pollSeconds * 1000);
} while (true);

async function scanOnce() {
  const profiles = await discoverTokens(config);
  console.log(`Discovered ${profiles.length} token profiles/boosts.`);

  for (const chainId of config.chains) {
    const chainProfiles = profiles.filter((profile) => profile.chainId === chainId);
    const byAddress = new Map(chainProfiles.map((profile) => [profile.tokenAddress.toLowerCase(), profile]));
    const pairs = await fetchTokenPairs(chainId, chainProfiles.map((profile) => profile.tokenAddress), config);
    const pairsByToken = groupPairsByToken(pairs);

    for (const [address, tokenPairs] of pairsByToken.entries()) {
      const profile = byAddress.get(address);
      const pair = pickBestPair(tokenPairs, config.maxPairAgeHours);
      if (!profile || !pair) continue;

      const snapshot = snapshotFromPair(pair, profile);
      store.upsertToken({
        chainId,
        tokenAddress: snapshot.tokenAddress,
        symbol: snapshot.symbol,
        name: snapshot.name,
        url: snapshot.url
      });
      store.addSnapshot(snapshot);

      const history = store.getSnapshots(chainId, snapshot.tokenAddress);
      const scores = scoreToken(snapshot, history);
      const chartFile = await writeChart(config.chartDir, { ...snapshot, classification: scores.classification }, history, scores);

      if (
        shouldAlert(snapshot, scores, config) &&
        store.canAlert(chainId, snapshot.tokenAddress, scores.classification, config.alertCooldownMinutes)
      ) {
        const sent = await sendTelegramAlert(config, snapshot, scores, chartFile);
        if (sent) {
          store.markAlert(chainId, snapshot.tokenAddress, scores.classification);
          console.log(`Alert sent for ${snapshot.symbol} (${chainId}).`);
        }
      } else {
        console.log(`${snapshot.symbol} ${chainId}: survival=${scores.survivalScore}, exchange=${scores.exchangePotential}, risk=${scores.rugRisk}`);
      }
    }
  }

  await store.save();
}

function groupPairsByToken(pairs) {
  const grouped = new Map();
  for (const pair of pairs) {
    const address = String(pair.baseToken?.address || "").toLowerCase();
    if (!address) continue;
    grouped.set(address, [...(grouped.get(address) || []), pair]);
  }
  return grouped;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
