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

const ATTACKS = [
  ['over-cap', 'Per-payment cap', 'Try 11 NIGHT when the hidden cap is 10.'],
  ['cumulative-budget', 'Cumulative budget', 'Try 8 more NIGHT after spending 5.'],
  ['wrong-recipient', 'Recipient binding', 'Replace the precommitted vendor with an attacker.'],
  ['replay', 'Replay protection', 'Submit the already-consumed payment again.'],
] as const;

const FLOW_STEPS = ['Deploy vault', 'Create proposal', 'Prove payment', 'Test controls', 'Recover funds'];

function short(value: string | null | undefined, length = 11): string {
  if (!value) return '—';
  return value.length <= length * 2 ? value : `${value.slice(0, length)}…${value.slice(-length)}`;
}

function networkLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return value === 'undeployed' ? 'Local devnet (SDK id: undeployed)' : value;
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
  busy = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      className={`button ${tone}`}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
    >
      {children}
    </button>
  );
}

function ProductHeader({
  phase,
  observerPage = false,
}: {
  phase: DemoSnapshot['phase'];
  observerPage?: boolean;
}) {
  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="Midnight Mandate home">
        <span className="brand-mark" aria-hidden="true">M</span>
        <span>
          <strong>Midnight Mandate</strong>
          <small>Private agent payment controls</small>
        </span>
      </a>
      <div className="header-actions">
        <span className="network-status"><i aria-hidden="true" /> Local devnet · {phase}</span>
        <a
          className="text-link"
          href={observerPage ? '/' : '/observer'}
          target={observerPage ? undefined : '_blank'}
          rel={observerPage ? undefined : 'noreferrer'}
        >
          {observerPage ? 'Demo console' : 'Public observer'} <span aria-hidden="true">{observerPage ? '←' : '↗'}</span>
        </a>
      </div>
    </header>
  );
}

function CommandCenter() {
  const [state, setState] = useState<DemoSnapshot>(EMPTY);
  const [instruction, setInstruction] = useState('Pay 5 NIGHT to vendor for invoice INV-42');
  const [mode, setMode] = useState<DemoMode>('deterministic');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.state()
      .then((next) => {
        if (active) setState(next);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  const allRejected = useMemo(
    () => Object.values(state.attacks).every((value) => value === 'rejected-no-movement'),
    [state.attacks],
  );

  const flowIndex = state.phase === 'cold'
    ? 0
    : state.phase === 'ready'
      ? 1
      : state.phase === 'proposed'
        ? 2
        : state.phase === 'paid'
          ? allRejected ? 4 : 3
          : 5;

  const nextAction = state.phase === 'cold'
    ? {
        eyebrow: 'Start here',
        title: 'Initialize the private mandate',
        description: 'Deploy the Compact contract and fund its local devnet vault with test NIGHT.',
      }
    : state.phase === 'ready'
      ? {
          eyebrow: 'Next action',
          title: 'Describe the payment',
          description: 'Create the typed request the untrusted agent will ask the contract to approve.',
        }
      : state.phase === 'proposed'
        ? {
            eyebrow: 'Next action',
            title: 'Prove and settle atomically',
            description: 'The contract will verify the private mandate before it releases any funds.',
          }
        : state.phase === 'paid' && !allRejected
          ? {
              eyebrow: 'Now pressure-test it',
              title: 'Run the four rejection checks',
              description: 'Each attack uses the real contract path and must leave balances unchanged.',
            }
          : state.phase === 'paid'
            ? {
                eyebrow: 'Final control',
                title: 'Recover the remaining funds',
                description: 'Prove owner authority, return the vault balance, and close it permanently.',
              }
            : {
                eyebrow: 'Demo complete',
                title: 'Funds recovered. Vault closed.',
                description: 'The payment succeeded, four invalid requests failed, and the owner exited safely.',
              };

  const busyMessage = busy === 'initialize'
    ? 'Deploying and funding the contract. The local Midnight stack may take a little while; keep this tab open.'
    : busy === 'proposal'
      ? 'Turning the instruction into a typed payment proposal.'
      : busy === 'pay'
        ? 'Generating the zero-knowledge proof, submitting the transaction, and waiting for indexed settlement.'
        : busy === 'close-vault'
          ? 'Proving owner authority, recovering the remaining balance, and closing the vault.'
          : busy
            ? 'Submitting the attack through the real contract path and checking that balances do not move.'
            : `${nextAction.eyebrow}: ${nextAction.title}`;

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
    <>
      <a className="skip-link" href="#workspace">Skip to demo controls</a>
      <main id="main-content">
        <ProductHeader phase={state.phase} />

        <section className="intro" aria-labelledby="product-title">
          <div className="intro-copy">
            <span className="eyebrow">Proof-backed controls for autonomous spending</span>
            <h1 id="product-title">Private spending rules that control the payment.</h1>
            <p>
              An agent proposes a payment. Midnight verifies the hidden limits and recipient,
              then releases—or refuses—the funds in the same contract call.
            </p>
            <div className="trust-row" aria-label="Core properties">
              <span>Policy opening stays private</span>
              <span>Receipt is public</span>
              <span>Settlement is atomic</span>
            </div>
          </div>

          <aside className="next-action" aria-labelledby="next-action-title">
            <span className="eyebrow">{nextAction.eyebrow}</span>
            <h2 id="next-action-title">{nextAction.title}</h2>
            <p>{nextAction.description}</p>
            <ol className="flow-progress" aria-label="Demo progress">
              {FLOW_STEPS.map((step, index) => (
                <li
                  key={step}
                  className={flowIndex > index ? 'complete' : flowIndex === index ? 'current' : ''}
                  aria-current={flowIndex === index ? 'step' : undefined}
                >
                  <span aria-hidden="true">{flowIndex > index ? '✓' : index + 1}</span>
                  <small>{step}</small>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section className="session-bar" aria-label="Demo session">
          <div>
            <span className="session-label">Contract</span>
            <code>{state.observer ? short(state.observer.contractAddress, 13) : 'Not deployed'}</code>
          </div>
          <ActionButton
            onClick={() => void run('initialize', api.initialize)}
            disabled={Boolean(busy) || state.phase !== 'cold'}
            busy={busy === 'initialize'}
          >
            {busy === 'initialize'
              ? 'Deploying and funding…'
              : state.phase === 'cold'
                ? 'Initialize real vault'
                : state.phase === 'closed'
                  ? 'Vault closed'
                  : 'Vault initialized'}
          </ActionButton>
        </section>

        <div className="operation-status" role="status" aria-live="polite" aria-atomic="true">
          <span className={busy ? 'status-spinner' : 'status-dot'} aria-hidden="true" />
          {busyMessage}
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Action did not complete</strong>
              <span>{error}</span>
              <small>No success state was recorded. Review the message before trying again.</small>
            </div>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">Dismiss</button>
          </div>
        )}

        <section id="workspace" className="workspace" aria-busy={Boolean(busy)}>
          <div className="workspace-main">
            <article className="card mandate-card">
              <div className="card-heading">
                <div>
                  <span className="section-number">01</span>
                  <h2>Owner mandate</h2>
                </div>
                <span className="visibility-label private">Private opening</span>
              </div>
              <p className="card-copy">
                Only a commitment reaches the ledger. The caps, recipient opening, policy secret,
                and recovery secret remain in local private state.
              </p>
              <div className="policy-status">
                <span>{state.owner ? 'Active mandate' : 'Deployment preview'}</span>
                <small>{state.owner ? 'Committed and funded on local devnet' : 'These values are committed when you initialize'}</small>
              </div>
              <div className="rule-grid">
                <Metric label="Per payment" value={`${state.owner?.maxPerPayment ?? '10'} NIGHT`} />
                <Metric label="Total spend" value={`${state.owner?.maxTotalSpend ?? '12'} NIGHT`} />
                <Metric label="Recipient" value={state.owner?.allowedRecipientAlias ?? 'vendor only'} />
              </div>
              <div className="balance-strip">
                <div><span>Deposited</span><strong>{state.owner?.initialBudget ?? '—'} NIGHT</strong></div>
                <div><span>Vault now</span><strong>{state.owner?.vaultBalance ?? '—'} NIGHT</strong></div>
                <div><span>Private allowance left</span><strong>{state.owner?.remainingPrivateBudget ?? '—'} NIGHT</strong></div>
              </div>
            </article>

            <article className="card request-card">
              <div className="card-heading">
                <div>
                  <span className="section-number">02</span>
                  <h2>Agent request</h2>
                </div>
                <span className="visibility-label untrusted">Untrusted input</span>
              </div>
              <p className="card-copy">
                Natural language is converted into a typed proposal. The adapter may suggest;
                only the contract can authorize the transfer.
              </p>
              <label className="input-label" htmlFor="instruction">Payment instruction</label>
              <textarea
                id="instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                disabled={Boolean(busy)}
                aria-describedby="adapter-help"
              />
              <div className="adapter-controls">
                <div className="mode-group" role="group" aria-label="Proposal adapter">
                  <button
                    type="button"
                    className={mode === 'deterministic' ? 'mode active' : 'mode'}
                    onClick={() => setMode('deterministic')}
                    aria-pressed={mode === 'deterministic'}
                    disabled={Boolean(busy)}
                  >
                    Deterministic
                  </button>
                  <button
                    type="button"
                    className={mode === 'live-ai' ? 'mode active' : 'mode'}
                    onClick={() => setMode('live-ai')}
                    aria-pressed={mode === 'live-ai'}
                    disabled={Boolean(busy)}
                  >
                    Live AI · $0.01
                  </button>
                </div>
                <small id="adapter-help">
                  {mode === 'deterministic'
                    ? 'Reliable demo path; no model call required.'
                    : 'Optional paid adapter; contract enforcement is unchanged.'}
                </small>
              </div>
              <div className="button-row">
                <ActionButton
                  tone="secondary"
                  disabled={Boolean(busy) || state.phase === 'cold' || state.phase === 'closed'}
                  busy={busy === 'proposal'}
                  onClick={() => void run('proposal', () => api.propose(instruction, mode))}
                >
                  {busy === 'proposal' ? 'Creating proposal…' : 'Create typed proposal'}
                </ActionButton>
                <ActionButton
                  disabled={Boolean(busy) || !state.agent.proposal || state.phase === 'closed'}
                  busy={busy === 'pay'}
                  onClick={() => void run('pay', api.pay)}
                >
                  {busy === 'pay' ? 'Proving and settling…' : 'Prove & release payment'}
                </ActionButton>
              </div>
              {state.agent.proposal && (
                <div className="proposal-card" aria-label="Typed payment proposal">
                  <div><span>Amount</span><strong>{state.agent.proposal.amount} NIGHT</strong></div>
                  <div><span>Recipient</span><code>{short(state.agent.proposal.recipient, 7)}</code></div>
                  <div><span>Request hash</span><code>{short(state.agent.proposal.requestHash, 7)}</code></div>
                </div>
              )}
            </article>
          </div>

          <aside className="card proof-card" aria-labelledby="proof-title">
            <div className="card-heading">
              <div>
                <span className="section-number">03</span>
                <h2 id="proof-title">Public proof</h2>
              </div>
              <span className="visibility-label public">Ledger visible</span>
            </div>
            <p className="card-copy">
              This is a dedicated indexer projection—not a private owner object hidden with CSS.
            </p>
            {state.observer?.latestReceipt ? (
              <div className="receipt-card" role="status" aria-live="polite">
                <span className="receipt-icon" aria-hidden="true">✓</span>
                <div>
                  <strong>Exact request verified on-ledger</strong>
                  <p>The receipt matches this proposal hash and its nullifier is consumed.</p>
                </div>
              </div>
            ) : (
              <div className="receipt-card pending">
                <span className="receipt-icon" aria-hidden="true">–</span>
                <div>
                  <strong>No payment receipt yet</strong>
                  <p>Initialize, propose, and pay to create a verifiable public receipt.</p>
                </div>
              </div>
            )}
            <div className="ledger-list">
              <div><span>Policy commitment</span><code>{short(state.observer?.policyCommitment, 8)}</code></div>
              <div><span>Owner commitment</span><code>{short(state.observer?.ownerCommitment, 8)}</code></div>
              <div><span>Vault lifecycle</span><strong>{state.observer?.active === false ? 'closed' : state.observer ? 'active' : '—'}</strong></div>
              <div><span>Payments / nullifiers</span><strong>{state.observer?.paymentCount ?? '—'} / {state.observer?.usedNullifiers ?? '—'}</strong></div>
              <div><span>Public spend</span><strong>{state.observer?.cumulativeSpend ?? '—'} NIGHT</strong></div>
              <div><span>Public vault balance</span><strong>{state.observer?.vaultBalance ?? '—'} NIGHT</strong></div>
              <div><span>Hidden from this view</span><strong className="safe">caps · recipient · secrets</strong></div>
            </div>
            {state.observer?.latestReceipt && (
              <div className="receipt-detail">
                <span>Request commitment</span><code>{short(state.observer.latestReceipt.requestCommitment, 9)}</code>
                <span>Consumed nullifier</span><code>{short(state.observer.latestReceipt.nullifier, 9)}</code>
              </div>
            )}
            <a className="proof-link" href="/observer" target="_blank" rel="noreferrer">
              Open isolated observer <span aria-hidden="true">↗</span>
            </a>
          </aside>
        </section>

        <section className="attack-section" aria-labelledby="attack-title">
          <div className="section-title">
            <div>
              <span className="eyebrow">04 · Adversarial verification</span>
              <h2 id="attack-title">Pressure-test the mandate</h2>
              <p>These are real rejected transactions, not simulated UI states.</p>
            </div>
            <span className={allRejected ? 'verified-pill success' : 'verified-pill'}>
              {allRejected ? '4 of 4 blocked' : state.phase === 'paid' ? 'Ready to test' : 'Unlocks after payment'}
            </span>
          </div>
          <div className="attack-grid">
            {ATTACKS.map(([kind, title, detail]) => {
              const rejected = state.attacks[kind] === 'rejected-no-movement';
              return (
                <button
                  type="button"
                  key={kind}
                  className={`attack-card ${rejected ? 'rejected' : ''}`}
                  onClick={() => attack(kind)}
                  disabled={Boolean(busy) || state.phase !== 'paid' || rejected}
                  aria-busy={busy === kind}
                >
                  <span className="attack-state" aria-hidden="true">{rejected ? '✓' : 'Test'}</span>
                  <span>
                    <strong>{busy === kind ? 'Submitting real attack…' : title}</strong>
                    <small>{rejected ? 'Rejected · zero balance movement' : detail}</small>
                    <span className="sr-only">{rejected ? 'Test passed' : 'Not tested'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={`recovery-card ${allRejected ? 'unlocked' : ''}`} aria-labelledby="recovery-title">
          <div>
            <span className="eyebrow">05 · Owner escape hatch</span>
            <h2 id="recovery-title">Recover funds and close the vault</h2>
            <p>
              {state.owner?.active === false
                ? `${state.owner.recoveredAmount} NIGHT returned to the owner. The vault is permanently closed.`
                : allRejected
                  ? 'All rejection paths passed. Owner-only recovery is now ready for the demo.'
                  : 'Run all four rejection checks to unlock this final demo step.'}
            </p>
          </div>
          <ActionButton
            tone="danger"
            disabled={Boolean(busy) || !allRejected || !state.owner?.active}
            busy={busy === 'close-vault'}
            onClick={() => void run('close-vault', api.closeVault)}
          >
            {busy === 'close-vault'
              ? 'Proving owner and recovering…'
              : state.owner?.active === false
                ? 'Recovery complete'
                : `Recover ${state.owner?.vaultBalance ?? '—'} NIGHT & close`}
          </ActionButton>
        </section>

        <section className="evidence-section" aria-labelledby="evidence-title">
          <div>
            <span className="eyebrow">Audit trail</span>
            <h2 id="evidence-title">What actually happened</h2>
            <p>Only confirmed local-devnet transitions appear here.</p>
          </div>
          <div className="event-list" role="log" aria-live="polite" aria-label="Confirmed transaction events">
            {state.events.length === 0 && <p className="empty">Initialize the vault to begin the real proof path.</p>}
            {state.events.map((event) => (
              <div className={`event event-${event.kind}`} key={`${event.at}-${event.message}`}>
                <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                <p>{event.message}</p>
                {event.transactionId && <code title={event.transactionId}>{short(event.transactionId, 8)}</code>}
              </div>
            ))}
          </div>
        </section>

        <footer>
          <span>Midnight Mandate</span>
          <p>Private mandate · public unshielded settlement · local test assets only</p>
        </footer>
      </main>
    </>
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
    <>
      <a className="skip-link" href="#public-state">Skip to indexed state</a>
      <main id="main-content" className="observer-only">
        <ProductHeader phase={state.phase} observerPage />
        <header className="observer-hero">
          <div>
            <span className="eyebrow">Isolated public API projection</span>
            <h1>See exactly what the ledger reveals.</h1>
            <p>
              This route requests only indexer-visible contract fields and public unshielded balances.
              It never receives the private mandate opening or the agent instruction.
            </p>
          </div>
          <a className="button secondary link-button" href="/">Return to demo console</a>
        </header>
        {error && <div className="error-banner" role="alert"><div><strong>Observer unavailable</strong><span>{error}</span></div></div>}
        <section id="public-state" className="observer-proof">
          <div className="observer-ledger">
            <div className="card-heading">
              <div><span className="section-number">PUB</span><h2>Indexed contract state</h2></div>
              <span className="visibility-label public">Ledger visible</span>
            </div>
            <div className="ledger-list roomy" aria-live="polite">
              <div><span>Network</span><strong>{networkLabel(state.observer?.networkId)}</strong></div>
              <div><span>Contract</span><code>{short(state.observer?.contractAddress, 14)}</code></div>
              <div><span>Policy commitment</span><code>{short(state.observer?.policyCommitment, 14)}</code></div>
              <div><span>Owner commitment</span><code>{short(state.observer?.ownerCommitment, 14)}</code></div>
              <div><span>Vault lifecycle</span><strong>{state.observer?.active === false ? 'closed' : state.observer ? 'active' : '—'}</strong></div>
              <div><span>Accepted token color</span><code>{short(state.observer?.vaultColor, 14)}</code></div>
              <div><span>Vault balance</span><strong>{state.observer?.vaultBalance ?? '—'} NIGHT</strong></div>
              <div><span>Successful payments</span><strong>{state.observer?.paymentCount ?? '—'}</strong></div>
              <div><span>Cumulative spend</span><strong>{state.observer?.cumulativeSpend ?? '—'} NIGHT</strong></div>
              <div><span>Nullifiers / receipts</span><strong>{state.observer?.usedNullifiers ?? '—'} / {state.observer?.paymentReceipts ?? '—'}</strong></div>
              <div><span>Receipt integrity</span><strong className={state.observer?.latestReceipt ? 'safe' : ''}>{state.observer?.latestReceipt ? 'exact request verified' : '—'}</strong></div>
              <div><span>Latest request commitment</span><code>{short(state.observer?.latestReceipt?.requestCommitment, 14)}</code></div>
              <div><span>Latest nullifier</span><code>{short(state.observer?.latestReceipt?.nullifier, 14)}</code></div>
              <div><span>Vendor public balance</span><strong>{state.vendorBalance ?? '—'} NIGHT</strong></div>
            </div>
          </div>
          <aside className="absence-card">
            <span className="eyebrow">Absent by construction</span>
            <h2>No private policy object reaches this route.</h2>
            <p>
              Private caps, the preset recipient, policy secrets, recovery authority, and the natural-language
              instruction are never serialized here—so CSS or DevTools cannot reveal them.
            </p>
            <ul>
              <li>Commitments: public</li>
              <li>Receipt and nullifier: public</li>
              <li>Policy opening: private</li>
            </ul>
          </aside>
        </section>
        <section className="evidence-section observer-events" aria-labelledby="public-events-title">
          <div>
            <span className="eyebrow">Public audit trail</span>
            <h2 id="public-events-title">Confirmed transitions</h2>
          </div>
          <div className="event-list" role="log" aria-live="polite">
            {state.events.length === 0 && <p className="empty">No deployment has been initialized yet.</p>}
            {state.events.map((event) => (
              <div className={`event event-${event.kind}`} key={`${event.at}-${event.message}`}>
                <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString()}</time>
                <p>{event.message}</p>
                {event.transactionId && <code title={event.transactionId}>{short(event.transactionId, 8)}</code>}
              </div>
            ))}
          </div>
        </section>
        <footer>
          <span>Midnight Mandate</span>
          <p>Public observer · indexed contract state only</p>
        </footer>
      </main>
    </>
  );
}

export default function App() {
  return window.location.pathname === '/observer' ? <ObserverPage /> : <CommandCenter />;
}
