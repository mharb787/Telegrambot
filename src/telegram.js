import { readFile } from "node:fs/promises";
import path from "node:path";

export async function sendTelegramAlert(config, snapshot, scores, chartFile) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.log("Telegram is not configured; alert skipped.");
    return false;
  }

  const caption = [
    `${snapshot.symbol} on ${snapshot.chainId}`,
    `${scores.classification}`,
    `Survival: ${scores.survivalScore}/100 | Exchange: ${scores.exchangePotential}/100 | Risk: ${scores.rugRisk}/100`,
    `Liquidity: ${usd(snapshot.liquidityUsd)} | MC/FDV: ${usd(snapshot.marketCap || snapshot.fdv)} | 1H Vol: ${usd(snapshot.volume1h)}`,
    `Buy ratio: ${Math.round(scores.buyRatio * 100)}% | Age: ${scores.ageHours}h`,
    snapshot.url
  ].join("\n");

  await sendDocument(config, chartFile, caption);
  return true;
}

async function sendDocument(config, file, caption) {
  const form = new FormData();
  form.set("chat_id", config.telegramChatId);
  form.set("caption", caption.slice(0, 1024));
  const bytes = await readFile(file);
  form.set("document", new Blob([bytes], { type: "image/svg+xml" }), path.basename(file));

  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendDocument`, {
    method: "POST",
    body: form
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Telegram ${response.status}: ${body}`);
}

function usd(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
  if (number >= 1_000) return `$${(number / 1_000).toFixed(1)}K`;
  return `$${Math.round(number)}`;
}
