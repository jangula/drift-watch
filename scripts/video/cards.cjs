const { chromium } = require('playwright');
const base = `<style>body{margin:0;width:1600px;height:900px;background:#0e0f11;color:#e8e6e3;font-family:ui-sans-serif,system-ui,-apple-system;display:flex;flex-direction:column;justify-content:center;padding:0 140px;box-sizing:border-box}
h1{font-size:96px;margin:0;letter-spacing:-.03em} h1 span{color:#ff8000} p{font-size:36px;color:#b9b6b1;margin:22px 0 0;max-width:1200px;line-height:1.35}
.k{font-size:22px;color:#8b8f96;letter-spacing:.14em;text-transform:uppercase;margin-bottom:28px} .u{font-size:28px;color:#ff8000;margin-top:56px}</style>`;
const cards = {
  title: `${base}<div class="k">Agents Gone Rogue · Amsterdam 2026</div><h1>Drift <span>Watch</span></h1><p>A refunds agent that talks itself out of its own policy, and the watchdog that catches it.</p>`,
  end: `${base}<div class="k">The lesson</div><h1 style="font-size:72px">Audit what agents <span>write about themselves</span>, not just what they do.</h1><p class="u">drift-watch-demo.vercel.app · github.com/jangula/drift-watch</p>`,
};
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  for (const [k, h] of Object.entries(cards)) { await p.setContent(h); await p.screenshot({ path: `card_${k}.png` }); }
  await b.close(); })();
