import type {
  AttackKind,
  DemoMode,
  DemoSnapshot,
  PublicObserverSnapshot,
} from '../../src/demo-types.js';

async function request(path: string, init?: RequestInit): Promise<DemoSnapshot> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const body = (await response.json()) as DemoSnapshot | { error: string };
  if (!response.ok) {
    throw new Error('error' in body ? body.error : `request failed with ${response.status}`);
  }
  return body as DemoSnapshot;
}

export const api = {
  state: () => request('/api/state'),
  observer: async (): Promise<PublicObserverSnapshot> => {
    const response = await fetch('/api/observer', { headers: { accept: 'application/json' } });
    const body = (await response.json()) as PublicObserverSnapshot | { error: string };
    if (!response.ok) {
      throw new Error('error' in body ? body.error : `request failed with ${response.status}`);
    }
    return body as PublicObserverSnapshot;
  },
  initialize: () => request('/api/session', { method: 'POST' }),
  propose: (instruction: string, mode: DemoMode) =>
    request('/api/proposal', {
      method: 'POST',
      body: JSON.stringify({ instruction, mode }),
    }),
  pay: () => request('/api/pay', { method: 'POST' }),
  closeVault: () => request('/api/close-vault', { method: 'POST' }),
  attack: (kind: AttackKind) =>
    request('/api/attack', { method: 'POST', body: JSON.stringify({ kind }) }),
};
