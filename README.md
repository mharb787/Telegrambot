# Solana/Ethereum Token Watch Bot

This bot monitors new and boosted tokens on Solana and Ethereum, stores time-series snapshots, calculates risk and growth indicators, creates SVG chart images, and sends Telegram alerts.

## Features

- Watches Solana and Ethereum token profiles from DexScreener.
- Tracks liquidity, volume, market cap/FDV, buy/sell flow, token age, boosts, and social links.
- Calculates:
  - `Survival Score`
  - `Exchange Potential`
  - `Rug Risk`
  - `Hype Score`
- Generates SVG indicator charts.
- Sends Telegram alerts with the chart attached.
- Includes a GitHub Actions workflow so the bot can run without a local machine.

## Local Usage

Create `.env` from the example:

```powershell
Copy-Item .env.example .env
```

Set:

```text
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

Run one scan:

```powershell
npm run once
```

Run continuously:

```powershell
npm start
```

Run demo mode without live data:

```powershell
npm run demo
```

## GitHub Actions Usage

The workflow at `.github/workflows/token-watch.yml` runs every 5 minutes and can also be started manually from the Actions tab.

Add these repository secrets:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

For this Telegram chat, the detected `TELEGRAM_CHAT_ID` is:

```text
12204622
```

Do not commit the bot token to the repository. Store it only as a GitHub Actions secret.

## Notes

- This is an analysis and alerting bot, not a trading bot.
- Scores are probabilistic filters, not investment advice.
- DexScreener does not provide deep contract security checks. Add GoPlus or TokenSniffer later for owner, mint, blacklist, tax, and honeypot checks.
- Social scoring in this MVP is based on available DexScreener social links and boosts. Direct X/Telegram community analysis can be added later with official APIs.
