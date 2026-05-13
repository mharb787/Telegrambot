import { existsSync, readFileSync } from "node:fs";

export function getConfig() {
  loadDotEnv();
  const env = process.env;
  const args = new Set(process.argv.slice(2));

  return {
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || "",
    telegramChatId: env.TELEGRAM_CHAT_ID || "",
    chains: split(env.CHAINS || "solana,ethereum"),
    pollSeconds: int(env.POLL_SECONDS, 300),
    maxPairAgeHours: int(env.MAX_PAIR_AGE_HOURS, 72),
    minLiquidityUsd: num(env.MIN_LIQUIDITY_USD, 10000),
    minVolume1hUsd: num(env.MIN_VOLUME_1H_USD, 5000),
    alertScoreMin: num(env.ALERT_SCORE_MIN, 65),
    rugRiskMax: num(env.RUG_RISK_MAX, 55),
    alertCooldownMinutes: int(env.ALERT_COOLDOWN_MINUTES, 180),
    runOnce: bool(env.RUN_ONCE) || args.has("--once"),
    demoMode: bool(env.DEMO_MODE) || args.has("--demo"),
    dataDir: env.DATA_DIR || "data",
    chartDir: env.CHART_DIR || "charts"
  };
}

function loadDotEnv() {
  if (!existsSync(".env")) return;
  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function split(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function int(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function num(value, fallback) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}
