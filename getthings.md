# Receiptor: what you still need and how to get it

This file is for the current project state. As of now, the file at the project root already contains the following values:

- ADMIN_USERNAME=ayo
- ADMIN_PASSWORD=Adeban1
- SESSION_SECRET=c4c6f89d97a2ac8a001a2a29a254613caa4790a7f9f29c8c30f447dd01d27e88
- COOKIE_SECURE=false
- WEB_ORIGIN=https://receiptor-app-web-hvdf.vercel.app
- NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
- SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/receiptor

What you still do NOT have yet:

- MERCHANT_SECRET_KEY
- RECEIPT_LEDGER_CONTRACT_ID

You also need the same contract ID in the browser env file:

- apps/web/.env.local -> NEXT_PUBLIC_RECEIPT_LEDGER_CONTRACT_ID

The web app is already configured for testnet. The two missing values are the merchant wallet secret and the deployed ReceiptLedger contract ID.

---

## 1) Get the merchant wallet secret key

This secret key is the private key for the wallet the indexer will use to submit receipts to the Soroban contract. It is used only on the server side. Never paste it into a public browser variable, GitHub issue, or a frontend env file.

### Step 1: Install Freighter

Official site: https://www.freighter.app/

Official docs: https://docs.freighter.app/

Install the browser extension and create or import a wallet.

### Step 2: Create or import a wallet

In Freighter:

1. Open the extension.
2. Create a new wallet or import an existing one.
3. Save the recovery phrase somewhere safe.
4. Open the account details / account settings.
5. Copy the secret key.

The secret key starts with `S` and looks like:

```text
SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

This is your merchant wallet secret.

### Step 3: Fund the wallet on Stellar testnet

Use Friendbot to fund the wallet on testnet.

Official Friendbot link: https://friendbot.stellar.org/

Put your public key from Freighter into the form. The public key starts with `G`.

If you want to do it manually with curl, use:

```bash
curl "https://friendbot.stellar.org/?addr=YOUR_PUBLIC_KEY_HERE"
```

Example:

```bash
curl "https://friendbot.stellar.org/?addr=GABC123..."
```

### Step 4: Put it in your env file

In the project root file `.env.local`, set:

```env
MERCHANT_SECRET_KEY=SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Do not use `NEXT_PUBLIC_MERCHANT_SECRET_KEY`.

---

## 2) Get the ReceiptLedger contract ID

This is the Soroban contract address that your app uses for receipt recording and ledger reads.

### Option A: If you already deployed the contract

Look in the deploy output or deployment logs. The contract ID will look like this:

```text
CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

That is the value to use for:

```env
RECEIPT_LEDGER_CONTRACT_ID=CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

and also in the web app env:

```env
NEXT_PUBLIC_RECEIPT_LEDGER_CONTRACT_ID=CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Option B: Deploy it yourself

Official Stellar docs: https://developers.stellar.org/docs

Soroban CLI docs: https://developers.stellar.org/docs/build/sdks/cli

Stellar CLI GitHub: https://github.com/stellar/stellar-cli

#### Install Stellar CLI

Follow the current install instructions from the official CLI docs:

- Official install docs: https://developers.stellar.org/docs/build/sdks/cli
- GitHub release page: https://github.com/stellar/stellar-cli/releases

For macOS/Linux, the usual pattern is:

```bash
curl -L https://github.com/stellar/stellar-cli/releases/latest/download/stellar-x86_64-unknown-linux-gnu.tar.gz -o stellar.tar.gz
mkdir -p ~/.local/bin
# extract as needed and place the binary in your PATH
```

After install, verify:

```bash
soroban --version
```

#### Fund the deploy account

If your deployment uses a wallet secret, fund it with Friendbot on testnet:

```bash
curl "https://friendbot.stellar.org/?addr=YOUR_PUBLIC_KEY"
```

#### Deploy the contract to testnet

Use your contract deploy command. Typical pattern:

```bash
soroban contract deploy \
  --network testnet \
  --source-account YOUR_ACCOUNT_NAME \
  --wasm target/wasm32-unknown-unknown/release/receipt_ledger.wasm
```

The output will include a contract ID. Example:

```text
Contract ID: CC3...A1
```

Copy that exact value and add it to your env file.

### Step 3: Put the contract ID in the correct places

In the project root `.env.local`:

```env
RECEIPT_LEDGER_CONTRACT_ID=CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

In the web app file `apps/web/.env.local`:

```env
NEXT_PUBLIC_RECEIPT_LEDGER_CONTRACT_ID=CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 3) Important: where to add each variable

### Server-only values (root `.env.local`)

These stay in the project root and are not exposed to the browser:

```env
ADMIN_USERNAME=ayo
ADMIN_PASSWORD=Adeban1
SESSION_SECRET=...
COOKIE_SECURE=false
WEB_ORIGIN=https://receiptor-app-web-hvdf.vercel.app
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/receiptor
MERCHANT_SECRET_KEY=SB...
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
RECEIPT_LEDGER_CONTRACT_ID=CC...
```

### Browser-safe values (apps/web/.env.local)

These are safe to expose to the frontend:

```env
NEXT_PUBLIC_INDEXER_API_URL=http://localhost:3001
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_RECEIPT_LEDGER_CONTRACT_ID=CC...
```

---

## 4) The exact values you need to fill now

You already have these values:

- ADMIN_USERNAME=ayo
- ADMIN_PASSWORD=Adeban1
- SESSION_SECRET=c4c6f89d97a2ac8a001a2a29a254613caa4790a7f9f29c8c30f447dd01d27e88
- NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
- SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
- WEB_ORIGIN=https://receiptor-app-web-hvdf.vercel.app

You still need:

- MERCHANT_SECRET_KEY
- RECEIPT_LEDGER_CONTRACT_ID

---

## 5) Quick check before you start the app

After you fill them in, confirm this is what your files look like:

`/root/.env.local` should contain:

```env
MERCHANT_SECRET_KEY=SB...
RECEIPT_LEDGER_CONTRACT_ID=CC...
```

`/apps/web/.env.local` should contain:

```env
NEXT_PUBLIC_RECEIPT_LEDGER_CONTRACT_ID=CC...
```

Then start the app:

```bash
pnpm --filter @receiptor/indexer dev
pnpm --filter @receiptor/web dev
```

Then open:

- Web app: http://localhost:3000
- Indexer API: http://localhost:3001

Sign in with:

- Username: ayo
- Password: Adeban1

---

## 6) Best links to keep handy

- Freighter wallet: https://www.freighter.app/
- Freighter docs: https://docs.freighter.app/
- Stellar Friendbot: https://friendbot.stellar.org/
- Stellar docs: https://developers.stellar.org/docs
- Soroban CLI docs: https://developers.stellar.org/docs/build/sdks/cli
- Stellar CLI GitHub: https://github.com/stellar/stellar-cli
- Stellar testnet explorer: https://testnet.stellarchain.io/

These are the current official links for the steps above and will stay the most relevant for onboarding and contract deployment.
