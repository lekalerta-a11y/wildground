# Build and deployment

```bash
npm ci
npm test
npm run build -- --base=./
```

Upload the contents of `dist/` with `index.html` at the ZIP root through iDosGames begin upload, HTTP PUT and finish upload. Stage and test before separately authorized publishing.

Published build: `bld4e5277d3034348f68b06efdf2956e06b` (v6).

- Title: `XCQ1T7X1`
- App: https://idosgames.com/app/XCQ1T7X1/
- Direct: https://xcq1t7x1.idos.games/
- RPC allowlist: `solana-rpc.publicnode.com`

Wallet login must be enabled. Do not enable a global wallet-only play rule, because ordinary PLAY stays free. The current client needs no CloudCode HTTP plan.

GitHub CI verifies builds and tests. It does not publish. Keep credentials out of source, logs and frontend assets.
