/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const code = readFileSync(new URL('../../server/wg-skin-access.js', import.meta.url), 'utf8');
const mint = '3hZ7a3r5ghQPnceqyjj4KTKi3yneWeKMmSTsqxX4idos';
function run(accounts: string[], signedIn = true, httpAllowed = true) {
  const handlers: Record<string, (args?: unknown) => { unlocked: boolean; balance?: string; reason?: string }> = {};
  let rpcCalls = 0;
  const server = {
    ReadUserData: () => signedIn ? { Blockchain: { LastWalletLogin: { NetworkID: 'solana', Address: 'verified-wallet' } } } : {},
    HttpRequest: (req: { Body: string }) => {
      rpcCalls++;
      expect(JSON.parse(req.Body).params[0]).toBe('verified-wallet');
      if (!httpAllowed) return { Success: false, Error: 'Not available on current plan' };
      return { Success: true, Data: { Ok: true, Body: JSON.stringify({ result: { value: accounts.map(amount => ({
        account: { data: { parsed: { info: { mint, owner: 'verified-wallet', tokenAmount: { amount, decimals: 6 } } } } },
      })) } }) } };
    },
  };
  runInNewContext(code, { handlers, server });
  return { result: () => handlers.checkWgSkinAccess({ address: 'attackers-wallet' }), get rpcCalls() { return rpcCalls; } };
}

describe('server WG skin access', () => {
  it('refuses guests without checking a caller-provided address', () => {
    const check = run([], false);
    expect(check.result()).toMatchObject({ unlocked: false, reason: 'wallet_required' });
    expect(check.rpcCalls).toBe(0);
  });
  it('sums the authenticated wallet accounts and grants exactly at the threshold', () => {
    expect(run(['60000000000', '40000000000']).result()).toMatchObject({ unlocked: true, balance: '100000000000' });
  });
  it('refuses below the threshold and permits above it with exact precision', () => {
    expect(run(['99999999999']).result().unlocked).toBe(false);
    expect(run(['99999999999999999']).result().unlocked).toBe(true);
  });
  it('fails closed on the actual plan limitation', () => {
    expect(() => run(['100000000000'], true, false).result()).toThrow();
  });
});
