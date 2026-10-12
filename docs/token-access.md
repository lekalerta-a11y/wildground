# WG cosmetic access

| Field | Value |
| --- | --- |
| Network | Solana mainnet |
| Mint | `3hZ7a3r5ghQPnceqyjj4KTKi3yneWeKMmSTsqxX4idos` |
| Decimals | 6 |
| Minimum | 100,000 WG |
| Raw threshold | 100,000,000,000 |
| RPC | `https://solana-rpc.publicnode.com` |
| Read | `getAccountInfo`, `jsonParsed`, `confirmed` |

Verification uses the mint, not the ticker. Connecting, signing a login message and checking balance do not transfer WG. Holding unlocks optional cosmetics. No staking, escrow, withdrawal or match reward is implemented.

The gate counts only the connected wallet's standard ATA. Extra accounts, custody and staking do not count. RPC failures keep skins locked and offer retry.

The exact threshold is tested with fixtures. Real RPC reads verified the mint and a zero-balance address. Wallet ownership was tested with a temporary unfunded signing key. A real holder's complete positive flow remains unverified.

See `src/core/tokenSkinAccess.ts` and `src/test/tokenSkinAccess.test.ts`.
