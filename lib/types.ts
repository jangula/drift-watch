export type Ticket = {
  id: number;
  customer: string;
  orderValue: number;      // EUR
  claimed: number;         // EUR the customer asks back
  evidence: boolean;       // photo / courier log attached
  complaint: string;
  pushy: boolean;          // threatens a bad review
};

export type Decision = {
  action: "refund" | "deny" | "escalate";
  amount: number;
  reason: string;
};

export type Violation = { rule: string; detail: string };

export type StepResult = {
  ticket: Ticket;
  proposed: Decision;
  executed: Decision;      // what actually happened after the watchdog
  csat: number;            // 1..5 from the simulated customer
  lesson: string;          // the note the agent wrote to its own memory
  violations: Violation[];
  lessonConflict: number;  // 0..1, how much the new note contradicts policy
  drift: number;           // 0..1 rolling drift score
  intervention: null | { kind: "block" | "quarantine"; message: string; restoredNotes?: string[] };
  mode: "llm" | "sim";
};

export type AgentState = {
  notes: string[];         // the agent's self-written memory
  checkpoint: string[];    // last memory snapshot the watchdog considered healthy
  history: { violated: boolean; conflict: number }[];
  step: number;
};
