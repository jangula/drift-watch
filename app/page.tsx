"use client";
import { useRef, useState } from "react";
import type { AgentState, StepResult } from "@/lib/types";

const SEED = 42;
const eur = (n: number) => `€${n.toFixed(2)}`;
const emptyState = (): AgentState => ({ notes: [], checkpoint: [], history: [], step: 0 });

export default function Page() {
  const [watchdog, setWatchdog] = useState(false);
  const [state, setState] = useState<AgentState>(emptyState);
  const [log, setLog] = useState<StepResult[]>([]);
  const [quarantined, setQuarantined] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const stRef = useRef(state);
  stRef.current = state;

  async function runStep(pushy = false) {
    const res = await fetch("/api/step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: stRef.current, config: { watchdog, seed: SEED, pushy } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    stRef.current = data.state;
    setState(data.state);
    setLog((l) => [data.result, ...l]);
    if (data.result.intervention?.restoredNotes) setQuarantined((q) => [...data.result.intervention.restoredNotes, ...q]);
  }

  async function run(n: number, pushy = false) {
    setRunning(true); setError(null); stop.current = false;
    try {
      for (let i = 0; i < n && !stop.current; i++) await runStep(pushy);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    stop.current = true;
    setState(emptyState()); stRef.current = emptyState();
    setLog([]); setQuarantined([]); setError(null);
  }

  const chron = [...log].reverse();
  const leaked = chron.reduce((s, r) => s + (r.executed.action === "refund" && r.violations.length ? r.executed.amount : 0), 0);
  const saved = chron.reduce((s, r) => s + (r.intervention?.kind === "block" ? r.proposed.amount : 0), 0);
  const avgCsat = chron.length ? chron.reduce((s, r) => s + r.csat, 0) / chron.length : 0;
  const drift = chron.at(-1)?.drift ?? 0;
  const mode = chron.at(-1)?.mode;
  const conflictOf = new Map(chron.map((r) => [r.lesson, r.lessonConflict]));

  return (
    <main>
      <h1>Drift Watch</h1>
      <p className="lede">
        A refunds agent for a food delivery app. Its policy never changes. But it is scored on customer satisfaction, and after every
        ticket it writes itself a lesson that goes into every future prompt. Watch the lessons turn into rationalisations, and the
        refunds follow. Then turn on the watchdog and run it again.
      </p>

      <div className="controls">
        <button className="primary" disabled={running} onClick={() => run(1)}>Next ticket</button>
        <button disabled={running} onClick={() => run(10)}>Run 10</button>
        <button disabled={running} onClick={() => run(1, true)}>Send a pushy customer</button>
        {running && <button onClick={() => (stop.current = true)}>Stop</button>}
        <button disabled={running} onClick={reset}>Reset</button>
        <label className={`toggle ${watchdog ? "on" : ""}`}>
          <input type="checkbox" checked={watchdog} disabled={running} onChange={(e) => setWatchdog(e.target.checked)} />
          Watchdog {watchdog ? "on" : "off"}
        </label>
        {mode && <span className="badge">{mode === "llm" ? "Live model" : "Offline simulation"}</span>}
      </div>
      {error && <div className="err">{error}</div>}

      <div className="stats">
        <Stat v={String(state.step)} l="Tickets handled" />
        <Stat v={avgCsat ? avgCsat.toFixed(1) : "–"} l="Average CSAT (what the agent optimises)" />
        <Stat v={eur(leaked)} l="Paid out against policy" color={leaked ? "var(--bad)" : undefined} />
        <Stat v={eur(saved)} l="Blocked by watchdog" color={saved ? "var(--ok)" : undefined} />
        <Stat v={drift.toFixed(2)} l="Drift score" color={drift >= 0.5 ? "var(--bad)" : drift >= 0.2 ? "var(--warn)" : "var(--ok)"} />
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Drift over time</h2>
        <DriftChart points={chron.map((r) => ({ d: r.drift, v: r.violations.length > 0, q: r.intervention?.kind === "quarantine" }))} />
      </div>

      <div className="grid">
        <section className="panel">
          <h2>Agent memory, written by the agent</h2>
          <div className="scroll">
            {state.notes.length === 0 && <p className="muted">Empty. The agent starts with only the policy.</p>}
            {state.notes.map((n, i) => {
              const c = conflictOf.get(n) ?? 0;
              return <div key={i} className={`note ${c >= 0.7 ? "c2" : c >= 0.3 ? "c1" : ""}`}>{n}</div>;
            })}
            {quarantined.length > 0 && (
              <>
                <h2 style={{ marginTop: 20 }}>Quarantined by watchdog</h2>
                {quarantined.map((n, i) => <div key={i} className="note c2 q">{n}</div>)}
              </>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Tickets, newest first</h2>
          <div className="scroll">
            {log.length === 0 && <p className="muted">No tickets yet. Press “Next ticket”.</p>}
            {log.map((r) => (
              <div key={r.ticket.id} className="row">
                <div className="top">
                  <span>#{r.ticket.id} {r.ticket.customer}: asks {eur(r.ticket.claimed)} of {eur(r.ticket.orderValue)}{r.ticket.evidence ? "" : ", no evidence"}</span>
                  <span>
                    {r.violations.length > 0 && <span className="tag viol">violation</span>}{" "}
                    <span className={`tag ${r.executed.action}`}>{r.executed.action}{r.executed.action === "refund" ? ` ${eur(r.executed.amount)}` : ""}</span>
                  </span>
                </div>
                <div className="meta">“{r.ticket.complaint}” · CSAT {r.csat}/5 · {r.proposed.reason}</div>
                {r.intervention && <div className={`alert ${r.intervention.kind}`}>{r.intervention.message}</div>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ v, l, color }: { v: string; l: string; color?: string }) {
  return <div className="stat"><div className="v" style={{ color }}>{v}</div><div className="l">{l}</div></div>;
}

function DriftChart({ points }: { points: { d: number; v: boolean; q: boolean }[] }) {
  const W = 1000, H = 140, P = 24;
  const n = Math.max(points.length, 20);
  const x = (i: number) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (d: number) => H - P - d * (H - 2 * P);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.d)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Drift score per ticket">
      <line x1={P} x2={W - P} y1={y(0.5)} y2={y(0.5)} stroke="var(--bad)" strokeDasharray="4 4" opacity=".6" />
      <text x={W - P} y={y(0.5) - 4} textAnchor="end">quarantine threshold</text>
      <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="var(--line)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((p, i) => (p.v || p.q) && (
        <circle key={i} cx={x(i)} cy={y(p.d)} r={p.q ? 6 : 4} fill={p.q ? "var(--bad)" : "var(--warn)"} />
      ))}
    </svg>
  );
}
