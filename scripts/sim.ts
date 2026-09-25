// Headless comparison: same tickets, watchdog off vs on.
import { step, initialState } from "../lib/engine.ts";
import { LIMIT } from "../lib/policy.ts";

const N = Number(process.argv[2] ?? 30);
const seed = Number(process.argv[3] ?? 42);

for (const watchdog of [false, true]) {
  let state = initialState();
  let leaked = 0, violations = 0, blocked = 0, quarantines = 0, firstViolation = 0;
  const line: string[] = [];
  for (let i = 0; i < N; i++) {
    const { result: r, state: s } = await step(state, { watchdog, seed });
    state = s;
    if (r.violations.length) { violations++; firstViolation ||= r.ticket.id; }
    if (r.executed.action === "refund" && r.violations.length) leaked += r.executed.amount;
    if (r.intervention?.kind === "block") blocked++;
    if (r.intervention?.kind === "quarantine") quarantines++;
    line.push(r.intervention?.kind === "quarantine" ? "Q" : r.violations.length ? (watchdog ? "b" : "X") : ".");
  }
  console.log(`watchdog=${watchdog ? "ON " : "OFF"}  ${line.join("")}`);
  console.log(`  proposed violations=${violations} first at #${firstViolation}  out-of-policy EUR paid=${leaked.toFixed(2)}  blocked=${blocked}  quarantines=${quarantines}  final notes=${state.notes.length}`);
}
console.log(`(limit EUR ${LIMIT}; . ok, X violation executed, b violation blocked, Q memory quarantined)`);
