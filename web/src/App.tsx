import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import type {
  AttackKind,
  DemoMode,
  DemoSnapshot,
  PublicObserverSnapshot,
} from '../../src/demo-types.js';

const EMPTY: DemoSnapshot = {
  phase: 'cold',
  owner: null,
  agent: {
    mode: 'deterministic',
    instruction: '',
    proposal: null,
    lastPaymentTransactionId: null,
  },
  observer: null,
  vendorBalance: null,
  attacks: {
    'over-cap': 'not-run',
    'cumulative-budget': 'not-run',
    'wrong-recipient': 'not-run',
    replay: 'not-run',
  },
  events: [],
};

function short(value: string | null | undefined, length = 11): string {
  if (!value) return '—';
  return value.length <= length * 2 ? value : `${value.slice(0, length)}…${value.slice(-length)}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <button className={`button ${tone}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function CommandCenter() {
  const [state, setState] = useState<DemoSnapshot>(EMPTY);
  const [instruction, setInstruction] = useState('Pay 5 NIGHT to vendor for invoice INV-42');
  const [mode, setMode] = useState<DemoMode>('deterministic');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.state().then(setState).catch(() => undefined);
  }, []);

  const allRejected = useMemo(
    () => Object.values(state.attacks).every((value) => value === 'rejected-no-movement'),
    [state.attacks],
  );

  async function run(label: string, operation: () => Promise<DemoSnapshot>) {
    setBusy(label);
    setError(null);
    try {
      setState(await operation());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  function attack(kind: AttackKind) {
    void run(kind, () => api.attack(kind));
  }

  return (
    <main>
      <header className="hero">
        <div>
          <div className="eyebrow"><span className="pulse" /> Midnight local devnet · live proof path</div>
          <h1>Private rules.<br /><em>Atomic</em> agent payments.</h1>
          <p>
            The agent proposes. Midnight proves hidden per-payment, cumulative, and recipient
            rules. The same contract call releases funds—or rejects without moving anything.
          </p>
        </div>
        <div className={`status-orb phase-${state.phase}`}>
          <span>{state.phase === 'cold' ? '01' : state.phase === 'ready' ? '02' : state.phase === 'proposed' ? '03' : state.phase === 'paid' ? '04' : '05'}</span>
          <small>{state.phase}</small>
        </div>
      </header>

      <section className="control-bar">
        <div>
          <span className="control-label">Demo session</span>
          <strong>{state.observer ? short(state.observer.contractAddress) : 'Not deployed'}</strong>
          <a className="observer-link" href="/observer">Isolated public observer ↗</a>
        </div>
        <ActionButton
          onClick={() => void run('initialize', api.initialize)}
          disabled={Boolean(busy) || state.phase !== 'cold'}
        >
          {busy === 'initialize'
            ? 'Deploying + funding…'
            : state.phase === 'cold'
              ? 'Initialize real vault'
              : state.phase === 'closed'
                ? 'Vault closed'
                : 'Vault ready'}
        </ActionButton>
      </section>

      {error && <div className="error-banner"><strong>Fail closed</strong><span>{error}</span></div>}

      <section className="three-column">
        <article className="panel owner-panel">
          <div className="panel-head">
            <div><span className="step">01</span><h2>Owner mandate</h2></div>
            <span className="privacy private">Private</span>
          </div>
          <p className="panel-copy">The policy opening stays in local private state. It never appears in the observer payload.</p>
          <div className="rule-card">
            <div><span>Max per payment</span><strong>{state.owner?.maxPerPayment ?? '10'} NIGHT</strong></div>
            <div><span>Max cumulative spend</span><strong>{state.owner?.maxTotalSpend ?? '12'} NIGHT</strong></div>
            <div><span>Allowed recipient</span><strong>{state.owner?.allowedRecipientAlias ?? 'vendor only'}</strong></div>
            <div><span>Policy secret</span><strong>local only · hidden</strong></div>
            <div><span>Recovery authority</span><strong>distinct owner secret</strong></div>
          </div>
          <div className="balance-row">
            <Metric label="Deposited" value={`${state.owner?.initialBudget ?? '—'} NIGHT`} />
            <Metric label="Vault now" value={`${state.owner?.vaultBalance ?? '—'} NIGHT`} />
            <Metric label="Private allowance left" value={`${state.owner?.remainingPrivateBudget ?? '—'} NIGHT`} />
          </div>
          <div className="owner-recovery">
            <div>
              <span>Emergency recovery</span>
              <small>
                {state.owner?.active === false
                  ? `${state.owner.recoveredAmount} NIGHT returned · permanently closed`
                  : 'Available after the four rejection checks · closes the vault permanently'}
              </small>
            </div>
            <ActionButton
              tone="danger"
              disabled={Boolean(busy) || !allRejected || !state.owner?.active}
              onClick={() => void run('close-vault', api.closeVault)}
            >
              {busy === 'close-vault'
                ? 'Proving owner + recovering…'
                : state.owner?.active === false
                  ? 'Vault closed'
                  : `Recover ${state.owner?.vaultBalance ?? '—'} & close`}
            </ActionButton>
          </div>
        </article>

        <article className="panel agent-panel">
          <div className="panel-head">
            <div><span className="step">02</span><h2>Agent proposal</h2></div>
            <span className="privacy bounded">Untrusted</span>
          </div>
          <label className="input-label" htmlFor="instruction">Natural-language request</label>
          <textarea
            id="instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            disabled={Boolean(busy)}
          />
          <div className="mode-row">
            <button className={mode === 'deterministic' ? 'mode active' : 'mode'} onClick={() => setMode('deterministic')}>Deterministic</button>
            <button className={mode === 'live-ai' ? 'mode active' : 'mode'} onClick={() => setMode('live-ai')}>Live AI · $0.01</button>
          </div>
          <div className="button-row">
            <ActionButton
              tone="secondary"
              disabled={Boolean(busy) || state.phase === 'cold' || state.phase === 'closed'}
              onClick={() => void run('proposal', () => api.propose(instruction, mode))}
            >
              {busy === 'proposal' ? 'Parsing…' : 'Create typed proposal'}
            </ActionButton>
            <ActionButton
              disabled={Boolean(busy) || !state.agent.proposal || state.phase === 'closed'}
              onClick={() => void run('pay', api.pay)}
            >
              {busy === 'pay' ? 'Proving + settling…' : 'Prove & pay'}
            </ActionButton>
          </div>
          {state.agent.proposal && (
            <div className="proposal-card">
              <div><span>Amount</span><strong>{state.agent.proposal.amount} NIGHT</strong></div>
              <div><span>Recipient</span><code>{short(state.agent.proposal.recipient, 7)}</code></div>
              <div><span>Request hash</span><code>{short(state.agent.proposal.requestHash, 7)}</code></div>
            </div>
          )}
        </article>

        <article className="panel observer-panel">
          <div className="panel-head">
            <div><span className="step">03</span><h2>Public observer</h2></div>
            <span className="privacy public">Public</span>
          </div>
          <p className="panel-copy">Built from ledger/indexer fields—not an owner object with hidden CSS.</p>
          <div className="ledger-list">
            <div><span>Policy commitment</span><code>{short(state.observer?.policyCommitment, 8)}</code></div>
            <div><span>Owner commitment</span><code>{short(state.observer?.ownerCommitment, 8)}</code></div>
            <div><span>Vault lifecycle</span><strong className={state.observer?.active === false ? '' : 'safe'}>{state.observer?.active === false ? 'closed' : state.observer ? 'active' : '—'}</strong></div>
            <div><span>Successful payments</span><strong>{state.observer?.paymentCount ?? '—'}</strong></div>
            <div><span>Cumulative public spend</span><strong>{state.observer?.cumulativeSpend ?? '—'} NIGHT</strong></div>
            <div><span>Used nullifiers</span><strong>{state.observer?.usedNullifiers ?? '—'}</strong></div>
            <div><span>Public vault balance</span><strong>{state.observer?.vaultBalance ?? '—'} NIGHT</strong></div>
            <div><span>Hidden from this view</span><strong className="safe">both caps · preset recipient · secret</strong></div>
          </div>
        </article>
      </section>

      <section className="attack-section">
        <div className="section-title">
          <div><span className="eyebrow">Adversarial proof</span><h2>Try to break the mandate</h2></div>
          <span className={allRejected ? 'verified-pill success' : 'verified-pill'}>{allRejected ? '4/4 blocked' : 'No mocked success'}</span>
        </div>
        <div className="attack-grid">
          {([
            ['over-cap', 'Spend 11 NIGHT', 'Private cap is 10'],
            ['cumulative-budget', 'Spend 8 more NIGHT', '5 + 8 exceeds hidden total of 12'],
            ['wrong-recipient', 'Pay attacker', 'Recipient is precommitted'],
            ['replay', 'Replay payment', 'Nonce was already consumed'],
          ] as const).map(([kind, title, detail]) => (
            <button
              key={kind}
              className={`attack-card ${state.attacks[kind] === 'rejected-no-movement' ? 'rejected' : ''}`}
              onClick={() => attack(kind)}
              disabled={
                Boolean(busy) ||
                state.phase !== 'paid' ||
                state.attacks[kind] === 'rejected-no-movement'
              }
            >
              <span className="attack-icon">{state.attacks[kind] === 'rejected-no-movement' ? '✓' : '×'}</span>
              <span><strong>{busy === kind ? 'Submitting real attack…' : title}</strong><small>{state.attacks[kind] === 'rejected-no-movement' ? 'Rejected · zero balance movement' : detail}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="evidence-section">
        <div>
          <span className="eyebrow">Evidence stream</span>
          <h2>What actually happened</h2>
        </div>
        <div className="event-list">
          {state.events.length === 0 && <p className="empty">Initialize the vault to begin the real proof path.</p>}
          {state.events.map((event) => (
            <div className={`event event-${event.kind}`} key={`${event.at}-${event.message}`}>
              <span>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <p>{event.message}</p>
              {event.transactionId && <code>{short(event.transactionId, 8)}</code>}
            </div>
          ))}
        </div>
      </section>

      <footer>
        <span>Midnight Mandate</span>
        <p>Private mandate · public unshielded settlement · local test assets only</p>
      </footer>
    </main>
  );
}

function ObserverPage() {
  const [state, setState] = useState<PublicObserverSnapshot>({
    phase: 'cold',
    observer: null,
    vendorBalance: null,
    events: [],
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let pending = false;

    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const next = await api.observer();
        if (active) {
          setState(next);
          setError(null);
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      } finally {
        pending = false;
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const refreshOnFocus = () => void refresh();

    void refresh();
    const interval = window.setInterval(() => void refresh(), 3_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, []);

  return (
    <main className="observer-only">
      <header className="observer-hero">
        <div>
          <div className="eyebrow"><span className="pulse" /> Public-only API projection</div>
          <h1>What the ledger<br /><em>actually reveals.</em></h1>
          <p>This route requests only indexer-visible contract fields and public unshielded balances.</p>
        </div>
        <a className="observer-link back" href="/">← Owner demo console</a>
      </header>
      {error && <div className="error-banner"><strong>Unavailable</strong><span>{error}</span></div>}
      <section className="observer-proof">
        <div className="observer-ledger">
          <div className="panel-head">
            <div><span className="step">PUB</span><h2>Indexed contract state</h2></div>
            <span className="privacy public">Public</span>
          </div>
          <div className="ledger-list roomy" aria-live="polite">
            <div><span>Network</span><strong>{state.observer?.networkId ?? '—'}</strong></div>
            <div><span>Contract</span><code>{short(state.observer?.contractAddress, 14)}</code></div>
            <div><span>Policy commitment</span><code>{short(state.observer?.policyCommitment, 14)}</code></div>
            <div><span>Owner commitment</span><code>{short(state.observer?.ownerCommitment, 14)}</code></div>
            <div><span>Vault lifecycle</span><strong>{state.observer?.active === false ? 'closed' : state.observer ? 'active' : '—'}</strong></div>
            <div><span>Accepted token color</span><code>{short(state.observer?.vaultColor, 14)}</code></div>
            <div><span>Vault balance</span><strong>{state.observer?.vaultBalance ?? '—'} NIGHT</strong></div>
            <div><span>Successful payments</span><strong>{state.observer?.paymentCount ?? '—'}</strong></div>
            <div><span>Cumulative spend</span><strong>{state.observer?.cumulativeSpend ?? '—'} NIGHT</strong></div>
            <div><span>Nullifiers / receipts</span><strong>{state.observer?.usedNullifiers ?? '—'} / {state.observer?.paymentReceipts ?? '—'}</strong></div>
            <div><span>Vendor public balance</span><strong>{state.vendorBalance ?? '—'} NIGHT</strong></div>
          </div>
        </div>
        <aside className="absence-card">
          <span className="eyebrow">Absent by construction</span>
          <h2>No private policy object reaches this route.</h2>
          <p>The endpoint returns a dedicated public projection. Private policy values and natural-language instructions are not serialized and cannot be recovered with CSS or DevTools.</p>
          <div className="absence-mark">∅</div>
        </aside>
      </section>
      <section className="evidence-section observer-events">
        <div><span className="eyebrow">Public evidence</span><h2>Confirmed transitions</h2></div>
        <div className="event-list">
          {state.events.length === 0 && <p className="empty">No deployment has been initialized yet.</p>}
          {state.events.map((event) => (
            <div className={`event event-${event.kind}`} key={`${event.at}-${event.message}`}>
              <span>{new Date(event.at).toLocaleTimeString()}</span>
              <p>{event.message}</p>
              {event.transactionId && <code>{short(event.transactionId, 8)}</code>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return window.location.pathname === '/observer' ? <ObserverPage /> : <CommandCenter />;
}
