import { describe, expect, it } from 'vitest';
import { wgBalanceFromRpc, wgBalanceFromStandardAccount, wgAssociatedTokenAccount, WG_MINT, WG_REQUIRED } from '../core/tokenSkinAccess';

const owner = 'wallet-owner';
const tokenAccount = (amount: string, mint = WG_MINT, decimals = 6, accountOwner = owner) => ({
  account: { data: { parsed: { info: { mint, owner: accountOwner, tokenAmount: { amount, decimals } } } } },
});

describe('WG holding requirement', () => {
  it('counts WG split across multiple accounts and unlocks exactly at 100,000', () => {
    const balance = wgBalanceFromRpc([tokenAccount('60000000000'), tokenAccount('40000000000')], owner);
    expect(balance).toBe(WG_REQUIRED);
    expect(balance >= WG_REQUIRED).toBe(true);
  });

  it('stays locked one raw unit below the threshold', () => {
    const balance = wgBalanceFromRpc([tokenAccount('99999999999')], owner);
    expect(balance >= WG_REQUIRED).toBe(false);
  });

  it('returns zero only for a successful empty account list', () => {
    expect(wgBalanceFromRpc([], owner)).toBe(0n);
    expect(() => wgBalanceFromRpc(undefined, owner)).toThrow();
  });

  it('rejects balances for another mint, another wallet or wrong decimals', () => {
    expect(() => wgBalanceFromRpc([tokenAccount('100000000000', 'another-mint')], owner)).toThrow();
    expect(() => wgBalanceFromRpc([tokenAccount('100000000000', WG_MINT, 9)], owner)).toThrow();
    expect(() => wgBalanceFromRpc([tokenAccount('100000000000', WG_MINT, 6, 'other-wallet')], owner)).toThrow();
  });

  it('preserves precision for large raw balances and rejects malformed values', () => {
    expect(wgBalanceFromRpc([tokenAccount('99999999999999999')], owner)).toBe(99999999999999999n);
    expect(() => wgBalanceFromRpc([tokenAccount('NaN')], owner)).toThrow();
  });

  it('validates the standard account program, mint and owner, and handles absent ATA', () => {
    const account = { ...tokenAccount('100000000000').account, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' };
    expect(wgBalanceFromStandardAccount(account, owner)).toBe(WG_REQUIRED);
    expect(wgBalanceFromStandardAccount(null, owner)).toBe(0n);
    expect(() => wgBalanceFromStandardAccount(undefined, owner)).toThrow();
    expect(() => wgBalanceFromStandardAccount({ ...account, owner: 'another-program' }, owner)).toThrow();
  });

  it('derives the same standard token account deterministically and rejects invalid wallet addresses', async () => {
    const wallet = '11111111111111111111111111111111';
    expect(await wgAssociatedTokenAccount(wallet)).toBe(await wgAssociatedTokenAccount(wallet));
    await expect(wgAssociatedTokenAccount('invalid')).rejects.toThrow();
  });
});
