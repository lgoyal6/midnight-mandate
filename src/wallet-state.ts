import { firstValueFrom, filter, timeout } from 'rxjs';
import type { MidnightWalletProvider } from './wallet.js';
import { hexToBytes } from './wallet/hex.js';

export function userAddressBytes(unshielded: any): Uint8Array {
  const publicKey = unshielded?.state?.publicKey ?? unshielded?.publicKey;
  if (publicKey?.address instanceof Uint8Array) return publicKey.address;
  if (typeof publicKey?.addressHex === 'string') return hexToBytes(publicKey.addressHex);

  const address = unshielded?.address;
  if (address?.bytes instanceof Uint8Array) return address.bytes;
  if (address?.data instanceof Uint8Array) return address.data;
  if (typeof address?.addressHex === 'string') return hexToBytes(address.addressHex);
  throw new Error('Could not find raw unshielded UserAddress bytes.');
}

export function balanceEntries(state: any): Array<[string, bigint]> {
  return Object.entries(state.unshielded.balances as Record<string, bigint>).map(
    ([color, value]) => [color.replace(/^0x/, ''), BigInt(value)],
  );
}

export function balanceFor(state: any, colorHex: string): bigint {
  return balanceEntries(state).find(([color]) => color === colorHex)?.[1] ?? 0n;
}

export async function walletState(wallet: MidnightWalletProvider): Promise<any> {
  return firstValueFrom(wallet.wallet.state());
}

export async function waitForWalletBalance(
  wallet: MidnightWalletProvider,
  colorHex: string,
  expected: bigint,
): Promise<any> {
  return firstValueFrom(
    wallet.wallet.state().pipe(
      filter((state: any) => balanceFor(state, colorHex) === expected),
      timeout(120_000),
    ),
  );
}
