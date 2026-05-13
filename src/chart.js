import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeChart(chartDir, token, history, scores) {
  await mkdir(chartDir, { recursive: true });
  const fileSafe = `${token.chainId}-${token.symbol}-${token.tokenAddress}`.replace(/[^a-z0-9-]/gi, "_").slice(0, 120);
  const file = path.join(chartDir, `${fileSafe}.svg`);
  const svg = renderChart(token, history.slice(-60), scores);
  await writeFile(file, svg, "utf8");
  return file;
}

function renderChart(token, history, scores) {
  const width = 1100;
  const height = 680;
  const pad = { left: 86, right: 36, top: 96, bottom: 76 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const series = [
    { key: "marketCap", label: "Market Cap", color: "#11a579" },
    { key: "liquidityUsd", label: "Liquidity", color: "#3969ac" },
    { key: "volume1h", label: "1H Volume", color: "#f2b701" }
  ];
  const values = history.flatMap((point) => series.map((item) => point[item.key] || 0));
  const max = Math.max(...values, 1);
  const min = 0;

  const polylines = series.map((item) => {
    const points = history.map((point, index) => {
      const x = pad.left + (history.length === 1 ? plotW : index * plotW / (history.length - 1));
      const y = pad.top + plotH - (((point[item.key] || 0) - min) / (max - min)) * plotH;
      return `${round(x)},${round(y)}`;
    }).join(" ");
    return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join("\n");

  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = pad.top + plotH - ratio * plotH;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#d7dde5" stroke-width="1"/><text x="24" y="${y + 5}" font-size="18" fill="#526070">${money(max * ratio)}</text>`;
  }).join("\n");

  const legend = series.map((item, index) => {
    const x = pad.left + index * 190;
    return `<rect x="${x}" y="624" width="18" height="18" rx="3" fill="${item.color}"/><text x="${x + 28}" y="639" font-size="20" fill="#26313d">${item.label}</text>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f7f9fb"/>
  <text x="36" y="46" font-size="30" font-family="Arial, sans-serif" font-weight="700" fill="#17202a">${escapeXml(token.name)} (${escapeXml(token.symbol)})</text>
  <text x="36" y="78" font-size="18" font-family="Arial, sans-serif" fill="#526070">${escapeXml(token.chainId)} | ${escapeXml(token.classification)} | ${escapeXml(token.url || "")}</text>
  <g font-family="Arial, sans-serif">
    <rect x="760" y="24" width="302" height="84" rx="8" fill="#ffffff" stroke="#d7dde5"/>
    <text x="780" y="54" font-size="18" fill="#26313d">Survival ${scores.survivalScore}/100</text>
    <text x="780" y="82" font-size="18" fill="#26313d">Exchange ${scores.exchangePotential}/100</text>
    <text x="930" y="54" font-size="18" fill="#26313d">Risk ${scores.rugRisk}/100</text>
    <text x="930" y="82" font-size="18" fill="#26313d">Hype ${scores.hypeScore}/100</text>
    ${grid}
    <rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="#ffffff" stroke="#c7d0da"/>
    ${polylines}
    ${legend}
  </g>
</svg>`;
}

function money(value) {
  if (value >= 1_000_000) return `$${round(value / 1_000_000)}M`;
  if (value >= 1_000) return `$${round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
