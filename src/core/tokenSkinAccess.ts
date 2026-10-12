import type { IDosGamesClient } from '@idosgames/core';

export const WG_MINT = '3hZ7a3r5ghQPnceqyjj4KTKi3yneWeKMmSTsqxX4idos';
export const WG_DECIMALS = 6;
export const WG_REQUIRED = 100_000n * 10n ** BigInt(WG_DECIMALS);
export const WG_RPC = 'https://solana-rpc.publicnode.com';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

export interface SkinAccessState {
  unlocked: boolean;
  busy: boolean;
  address: string | null;
  balance: bigint | null;
  message: string;
}

interface PhantomProvider {
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  on?(event: string, callback: () => void): void;
}

/** Sum raw units, never floating-point uiAmount, across every WG token account. */
export function wgBalanceFromRpc(value: unknown, owner: string): bigint {
  if (!Array.isArray(value)) throw new Error('Invalid balance response');
  let balance = 0n;
  for (const entry of value) {
    const info = entry?.account?.data?.parsed?.info;
    if (!info || info.mint !== WG_MINT || info.owner !== owner || info.tokenAmount?.decimals !== WG_DECIMALS
      || typeof info.tokenAmount.amount !== 'string' || !/^\d+$/.test(info.tokenAmount.amount)) {
      throw new Error('Invalid WG token account');
    }
    balance += BigInt(info.tokenAmount.amount);
  }
  return balance;
}

export async function wgAssociatedTokenAccount(owner: string): Promise<string> {
  const { address, getAddressEncoder, getProgramDerivedAddress } = await import('@solana/addresses');
  const encoder = getAddressEncoder();
  const [account] = await getProgramDerivedAddress({
    programAddress: address(ASSOCIATED_TOKEN_PROGRAM),
    seeds: [encoder.encode(address(owner)), encoder.encode(address(TOKEN_PROGRAM)), encoder.encode(address(WG_MINT))],
  });
  return account;
}

export function wgBalanceFromStandardAccount(account: unknown, owner: string): bigint {
  if (account === null) return 0n; // A successful RPC response says the ATA does not exist.
  if (!account || typeof account !== 'object' || !('owner' in account) || account.owner !== TOKEN_PROGRAM) {
    throw new Error('Invalid WG account response');
  }
  return wgBalanceFromRpc([{ account }], owner);
}

export async function readWgWalletBalance(owner: string): Promise<bigint> {
  const account = await wgAssociatedTokenAccount(owner);
  const response = await fetch(WG_RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAccountInfo',
      params: [account, { encoding: 'jsonParsed', commitment: 'confirmed' }] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('WG balance service is temporarily unavailable. Please retry.');
  const payload = await response.json();
  if (payload.error || !payload.result || !('value' in payload.result)) throw new Error('Could not read your WG balance. Please retry.');
  return wgBalanceFromStandardAccount(payload.result.value, owner);
}

export class TokenSkinAccess {
  private changed: (state: SkinAccessState) => void;
  private client: IDosGamesClient | null = null;
  private address: string | null = null;
  private busy = false;
  private generation = 0;
  private observedProvider: PhantomProvider | null = null;
  private state: SkinAccessState = {
    unlocked: false, busy: false, address: null, balance: null,
    message: 'Connect your Solana wallet to check your WG balance.',
  };

  constructor(changed: (state: SkinAccessState) => void) {
    this.changed = changed;
    window.addEventListener('focus', () => { if (this.address) void this.refresh(); });
    window.setInterval(() => { if (this.address && !document.hidden) void this.refresh(); }, 60_000);
  }

  private publish(update: Partial<SkinAccessState>) {
    this.state = { ...this.state, ...update, address: this.address, busy: this.busy };
    this.changed(this.state);
  }

  async connect() {
    if (this.busy) return;
    this.busy = true;
    const generation = ++this.generation;
    this.publish({ unlocked: false, message: 'Connect your wallet and sign the login message. No tokens are transferred.' });
    try {
      const [{ createIDosGamesClient }, wallet] = await Promise.all([
        import('@idosgames/core'), import('@idosgames/wallet'),
      ]);
      this.client ??= createIDosGamesClient({ titleID: 'XCQ1T7X1' });
      this.client.auth.setRememberSession(false);
      let result;
      if (wallet.isEmbeddedInPlatform()) {
        result = await wallet.loginWithWalletViaPlatform({ client: this.client, networkID: 'solana', family: 'solana' });
      } else {
        const browser = window as Window & { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
        const provider = browser.phantom?.solana ?? browser.solana;
        if (!provider) throw new Error('Open this game in a browser with Phantom, or play through idosgames.com.');
        const connected = await provider.connect();
        if (this.observedProvider !== provider) {
          provider.on?.('accountChanged', () => this.disconnect());
          provider.on?.('disconnect', () => this.disconnect());
          this.observedProvider = provider;
        }
        result = await wallet.loginWithWalletSolana({
          client: this.client, networkID: 'solana', walletAddress: connected.publicKey.toString(),
          signMessage: async (message) => (await provider.signMessage(message, 'utf8')).signature,
        });
      }
      if (!result.ok) throw new Error('Wallet login was not completed. Connect your wallet and try again.');
      const blockchain = await this.client.blockchain.getUserState();
      if (!blockchain.ok) throw new Error('Could not verify your wallet. Please try again.');
      const login = blockchain.data.State?.LastWalletLogin;
      if (login?.NetworkID !== 'solana' || !login.Address) throw new Error('No verified Solana wallet found. Please reconnect.');
      if (generation !== this.generation) return;
      this.address = login.Address;
      await this.readBalance(generation);
    } catch (error) {
      if (generation === this.generation) this.publish({ unlocked: false, balance: null,
        message: error instanceof Error ? error.message : 'Could not connect. Please try again.' });
    } finally {
      this.busy = false;
      this.publish({});
    }
  }

  async refresh() {
    if (this.busy || !this.address) return;
    this.busy = true;
    const generation = this.generation;
    this.publish({ unlocked: false, message: 'Checking your WG balance…' });
    try {
      await this.readBalance(generation);
    } catch {
      if (generation === this.generation) this.publish({ unlocked: false, balance: null,
        message: 'Could not read your WG balance. Please retry; your balance has not been treated as zero.' });
    } finally {
      this.busy = false;
      this.publish({});
    }
  }

  private async readBalance(generation: number) {
    const address = this.address!;
    const balance = await readWgWalletBalance(address);
    if (generation !== this.generation || address !== this.address) return;
    const unlocked = balance >= WG_REQUIRED;
    this.publish({ balance, unlocked, message: unlocked
      ? 'Skins unlocked. Keep at least 100,000 WG in this wallet.'
      : 'Hold at least 100,000 WG in your standard wallet token account to unlock skins.' });
  }

  disconnect() {
    this.generation++;
    this.address = null;
    this.client?.auth.logout();
    this.publish({ unlocked: false, balance: null, message: 'Wallet disconnected. Skins are locked.' });
  }
}
