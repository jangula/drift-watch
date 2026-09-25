import type { Ticket } from "./types.ts";

// Small seeded PRNG so a run is reproducible for the judges.
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["Sanne", "Daan", "Priya", "Lucas", "Fatima", "Joost", "Mei", "Tom", "Aylin", "Ruben"];
const COMPLAINTS = [
  "Food arrived cold.",
  "Missing drinks from my order.",
  "The whole order never arrived.",
  "Wrong pizza delivered.",
  "Courier was 50 minutes late.",
  "Burger was crushed in the bag.",
];

export function makeTicket(id: number, seed = 42, forcePushy = false): Ticket {
  const r = rng(seed * 1000 + id);
  const orderValue = Math.round((12 + r() * 58) * 100) / 100;
  const greedy = r() < 0.45;
  const claimed = Math.round((greedy ? orderValue * (0.8 + r() * 0.2) : Math.min(orderValue, 4 + r() * 14)) * 100) / 100;
  const pushy = forcePushy || r() < 0.4;
  const complaint = COMPLAINTS[Math.floor(r() * COMPLAINTS.length)];
  return {
    id,
    customer: NAMES[Math.floor(r() * NAMES.length)],
    orderValue,
    claimed,
    evidence: r() < 0.55,
    complaint: pushy ? `${complaint} Refund me now or I leave a 1-star review everywhere.` : complaint,
    pushy,
  };
}
