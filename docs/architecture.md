# Architecture

## Local gameplay

`src/main.ts` coordinates menus and the loop. `Match` steps movement, trails, collisions, capture and win conditions. `TerritoryGrid` stores ownership on a raster and uses flood fill for enclosed regions. The canvas renderer, minimap and HUD display local state.

`BotAIManager` assigns a brain to each bot. Four rule-based personalities share a state machine. Custom AI and fly connectome entries are templates.

## Optional wallet flow

`TokenSkinAccess` lazily loads the SDK when the player selects CONNECT & CHECK. Embedded games use the iDosGames wallet bridge. Standalone games use Phantom. A signed login message proves address control through iDosGames. The client reads authenticated `LastWalletLogin.Address` and requires Solana.

The official address package derives the ATA for that owner, WG mint and original SPL Token program. PublicNode `getAccountInfo` returns parsed data. The reader validates program, mint, owner, decimals and integer amount. It compares against `100_000 * 10^6` raw units. Missing accounts mean zero. Malformed responses and errors keep access locked.

Generation guards prevent old-wallet responses from enabling a new wallet. Refresh occurs on focus, each visible minute and before PLAY. Classic remains free.

## Trust boundary

A modified browser client can bypass a local cosmetic check. This mechanism must not authorize payouts, prizes or valuable inventory without server enforcement. A signature proves address control, not permanent entitlement.

Only the standard WG ATA counts. Extra accounts, custody and staking do not contribute. Exact-threshold fixtures pass, but a real holder's full unlock flow remains pending.

`server/wg-skin-access.js` is an unused CloudCode alternative. The published client does not call it because the tested platform plan disallowed outbound CloudCode HTTP.

## Hosting

Static Vite build on iDosGames Title `XCQ1T7X1`. Embedded network allowlist includes `solana-rpc.publicnode.com`. Ordinary matches need neither RPC nor wallet APIs.
