# StakePort — Production Deployment Playbook

This takes StakePort from a laptop (local Hardhat + SQLite + localhost) to a
fully public product, entirely on **free tiers**.

```
                       ┌────────────────────────────────────────────┐
   Browser ───────────▶│  Vercel  —  Next.js frontend + /api routes  │
                       └───────┬───────────────┬────────────────┬────┘
                               │               │                │
                    server-to-server      Prisma            wagmi/viem
                               │               │                │
                     ┌─────────▼──────┐  ┌─────▼──────┐  ┌───────▼────────┐
                     │ Render         │  │ Neon       │  │ Sepolia        │
                     │ FastAPI + ML   │  │ PostgreSQL │  │ (your contracts)│
                     └───────┬────────┘  └────────────┘  └────────────────┘
                             │
                   Gemini + SerpAPI + Pinata (IPFS)
```

| Piece | Runs on | Free tier |
|---|---|---|
| Frontend (Next.js) | **Vercel** | yes |
| AI engine (FastAPI + ML) | **Render** | yes (sleeps after 15 min idle) |
| Database (Postgres) | **Neon** | yes (0.5 GB) |
| Smart contracts | **Sepolia** testnet | free (faucet ETH) |
| IPFS pinning | **Pinata** | yes |
| RPC endpoint | **Alchemy** | yes |
| LLM | **Google Gemini** | free tier |
| Price scraping | **SerpAPI** | free tier (100/mo) |

---

## 0 · Accounts to create (all free)

1. **GitHub** — push this repo (Vercel + Render deploy from it).
2. **MetaMask** — create a **brand-new throwaway account** for deploying contracts. Never use a wallet with real funds.
3. **Alchemy** — https://dashboard.alchemy.com → create an app on **Ethereum → Sepolia** → copy the HTTPS URL.
4. **Neon** — https://neon.tech → new project (Postgres).
5. **Pinata** — https://app.pinata.cloud → you already have a JWT.
6. **Google AI Studio** — https://aistudio.google.com/apikey → you already have a Gemini key.
7. **SerpAPI** — https://serpapi.com → you already have a key.
8. **Vercel** — https://vercel.com (sign in with GitHub).
9. **Render** — https://render.com (sign in with GitHub).
10. *(optional)* **Etherscan** API key — to verify contract source.
11. *(optional)* **Reown/WalletConnect** project id — https://cloud.reown.com — enables mobile wallets. Desktop MetaMask works without it.

> **Rotate exposed keys.** The Pinata / Gemini / SerpAPI keys have been sitting in plaintext `.env` files during development. Before going public, regenerate fresh ones from each dashboard and use the new values everywhere below.

---

## 1 · Deploy the contracts to Sepolia

```bash
cd contracts
cp .env.example .env
```

Fill `contracts/.env`:

| Var | Where to get it |
|---|---|
| `SEPOLIA_RPC_URL` | Alchemy app → HTTPS URL |
| `DEPLOYER_PRIVATE_KEY` | MetaMask → throwaway account → Account details → Show private key |
| `ETHERSCAN_API_KEY` | *(optional)* etherscan.io/myapikey |

**Fund the deployer** with test ETH → https://cloud.google.com/application/web3/faucet/ethereum/sepolia (paste the throwaway account address).

Then:

```bash
npm install
npm run compile
npm run deploy:sepolia
```

The script prints a block like:

```
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x....
NEXT_PUBLIC_ASSET_FACTORY_ADDRESS=0x....
```

**Save these three values** — they go into Vercel in step 4. *(optional)* verify with the two `npx hardhat verify …` lines the script prints.

---

## 2 · Create the database (Neon)

1. Neon dashboard → your project → **Connection Details**.
2. Copy **two** strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL`
3. Append `?sslmode=require&pgbouncer=true` to the pooled one, and `?sslmode=require` to the direct one (Neon usually includes `sslmode` already).

**Create the tables** from your machine (one time):

```bash
cd frontend
# put the two Neon URLs in frontend/.env (DATABASE_URL + DIRECT_URL)
npm install
npm run db:push        # creates User, AssetMetadata, Trade, AuthNonce
```

`db push` reads `DIRECT_URL` (pgbouncer can't run schema changes). You should see "Your database is now in sync with your Prisma schema."

---

## 3 · Deploy the AI engine (Render)

Push the repo to GitHub first, then:

1. Render → **New → Blueprint** → select your repo. It auto-detects `ai-engine/render.yaml`.
   *(Or: New → Web Service → Root Directory `ai-engine`, Build `pip install -r requirements.txt`, Start `gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT --timeout 120`.)*
2. Set the environment variables (Render dashboard → the service → Environment):

| Var | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini key |
| `SERPAPI_KEY` | your SerpAPI key |
| `FRONTEND_ORIGINS` | `*` for now — tighten to the Vercel URL in step 5 |

3. Deploy. Copy the service URL, e.g. `https://stakeport-ai-engine.onrender.com`.
4. Sanity check: open `<url>/health` → `{"status":"ok",...}`.

> **Cold starts:** on the free tier the service sleeps after 15 min idle and takes ~30-50s to wake. The first asset-page appraisal after idle may be slow or time out — reload once. For a always-on demo, upgrade the Render service or ping `/health` on a cron.

---

## 4 · Deploy the frontend (Vercel)

1. Vercel → **New Project** → import your repo.
2. **Root Directory → `frontend`** (critical — it's a monorepo).
3. Framework preset: Next.js (auto). Build/install commands: leave default (our `package.json` handles `prisma generate`).
4. Add **Environment Variables** (Settings → Environment Variables). Everything below:

| Var | Value | Type |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** string | secret |
| `DIRECT_URL` | Neon **direct** string | secret |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` | public |
| `NEXT_PUBLIC_RPC_URL` | Alchemy Sepolia HTTPS URL | public |
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | `https://sepolia.etherscan.io` | public |
| `NEXT_PUBLIC_MOCK_USDC_ADDRESS` | from step 1 | public |
| `NEXT_PUBLIC_ASSET_FACTORY_ADDRESS` | from step 1 | public |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown id, or leave `stakeport-dev` | public |
| `JWT_SECRET` | **generate new**: `openssl rand -hex 32` | secret |
| `PINATA_JWT` | your Pinata JWT | secret |
| `AI_ENGINE_URL` | the Render URL from step 3 (no trailing slash) | secret |

5. Deploy. You get `https://<project>.vercel.app`.

---

## 5 · Close the loop

1. Back in **Render**, set `FRONTEND_ORIGINS` to your Vercel URL (e.g. `https://stakeport.vercel.app`) and redeploy the service. This locks CORS to your domain.
2. If you added a custom domain on Vercel, add it to `FRONTEND_ORIGINS` too (comma-separated).

---

## 6 · Smoke test the live site

1. Open the Vercel URL → landing page + shader render.
2. Connect MetaMask → **switch it to the Sepolia network**.
3. Click **Open Terminal** → sign the SIWE message → land on `/onboarding` → fill profile → `/markets`.
4. **Add Funds** → mints MockUSDC on Sepolia (needs a little Sepolia ETH for gas).
5. **List Asset** → images upload to IPFS, AI prospectus + fair value generate (first call wakes Render), mint confirms → asset page.
6. On the asset page: prospectus renders full-width, ML Fair Value gauge + Risk Alignment card populate.
7. Buy a few shares → toast confirms → check `/portfolio` P&L + sparkline.

---

## What changed in code for production

| File | Change |
|---|---|
| `frontend/prisma/schema.prisma` | SQLite → **PostgreSQL**, added `directUrl` + `rhel-openssl-3.0.x` binary target |
| `frontend/package.json` | `postinstall`/`build` run `prisma generate`; added `db:push` |
| `frontend/src/app/providers.tsx` | Sepolia transport reads `NEXT_PUBLIC_RPC_URL` (public-node fallback) |
| `ai-engine/main.py` | CORS from `FRONTEND_ORIGINS` env; added `/health` |
| `ai-engine/render.yaml` | Render blueprint (gunicorn + uvicorn worker) |
| `ai-engine/requirements.txt` | added `gunicorn` |
| `contracts/hardhat.config.ts` | added `sepolia` network + Etherscan + optimizer |
| `contracts/scripts/deploy.ts` | prints env block, seeds USDC, saves `deployed.*.json` |

## Which secrets are new vs reused

- **Generate fresh:** `JWT_SECRET` (prod), `DEPLOYER_PRIVATE_KEY` (throwaway wallet), Neon `DATABASE_URL`/`DIRECT_URL`, Alchemy `NEXT_PUBLIC_RPC_URL`, contract addresses.
- **Reuse (rotate recommended):** `PINATA_JWT`, `GEMINI_API_KEY`, `SERPAPI_KEY`.

## Free-tier limits to know

- **Render free** sleeps after 15 min idle → slow first AI call. Ping `/health` on a cron to keep warm.
- **Neon free**: 0.5 GB, autosuspends when idle (first query after idle is a touch slower).
- **SerpAPI free**: ~100 searches/month — fair-value calls are cached in Postgres (24h TTL) so this stretches far.
- **Sepolia faucets** are rate-limited; grab ETH a day ahead if listing many assets.
