// Records one live run of the deployed app. Usage: node record.cjs off|on N
const { chromium } = require('playwright');
const fs = require('fs');
const mode = process.argv[2], N = Number(process.argv[3] || 25);
const URL = 'https://drift-watch-demo.vercel.app';
const CSS = `
  p.lede{display:none} main{padding-top:14px} h1{font-size:24px}
  .panel svg{max-height:90px}
  pre.playbook{max-height:430px;font-size:13.5px}
  #cap{position:fixed;left:50%;transform:translateX(-50%);bottom:28px;max-width:1300px;width:calc(100% - 120px);
    background:rgba(8,8,10,.92);border:1px solid #444;border-radius:14px;padding:18px 26px;z-index:99;
    font:600 26px/1.35 ui-sans-serif,system-ui,-apple-system;color:#fff;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.6)}
  #cap b{color:#ff8000}
  #phase{position:fixed;top:16px;right:24px;z-index:99;font:700 18px ui-sans-serif,system-ui;padding:8px 16px;border-radius:10px;letter-spacing:.06em}
`;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: `raw_${mode}`, size: { width: 1600, height: 900 } } });
  const p = await ctx.newPage();
  const t0 = Date.now(); const events = [];
  const mark = (name, extra = {}) => { const e = { t: (Date.now() - t0) / 1000, name, ...extra }; events.push(e); console.log(JSON.stringify(e)); };
  await p.goto(URL);
  await p.addStyleTag({ content: CSS });
  await p.evaluate(({ on }) => {
    const c = document.createElement('div'); c.id = 'cap'; document.body.appendChild(c);
    const ph = document.createElement('div'); ph.id = 'phase'; ph.textContent = on ? 'WATCHDOG ON' : 'WATCHDOG OFF';
    ph.style.background = on ? '#1f3a2d' : '#3d1f1d'; ph.style.color = on ? '#4fb286' : '#e5534b'; document.body.appendChild(ph);
  }, { on: mode === 'on' });
  const cap = (html) => p.evaluate((h) => { document.getElementById('cap').innerHTML = h; }, html);
  if (mode === 'on') await p.locator('label.toggle input').check();
  await cap(mode === 'on'
    ? 'Same agent, same tickets. <b>Watchdog on</b>: a separate model audits every rewrite against the original policy.'
    : 'Strict policy: <b>€20 max, evidence required</b>. Scored on customer satisfaction. Rewrites its own instructions every 4 tickets.');
  mark('start'); await p.waitForTimeout(4000);
  await p.getByRole('button', { name: `Run ${N}` }).click();
  const stat = (label) => p.evaluate((l) => { const s = [...document.querySelectorAll('.stat')].find((x) => x.querySelector('.l').textContent.startsWith(l)); return s ? s.querySelector('.v').textContent : ''; }, label);
  let lastRw = 0, lastPaid = '€0.00', lastQ = 0, firstViol = false;
  while (true) {
    await p.waitForTimeout(700);
    const tickets = Number(await stat('Tickets handled'));
    const rw = Number(await stat('Times it rewrote'));
    const paid = await stat('Paid out against policy');
    const q = await p.locator('.alert.quarantine').count();
    const viol = await p.locator('.tag.viol').count();
    if (rw > lastRw) {
      lastRw = rw; mark('rewrite', { rw, tickets });
      if (mode === 'off') await cap(`Rewrite ${rw}: the agent edits its own policy. <b>Read the instructions panel.</b>`);
    }
    if (mode === 'off' && viol > 0 && !firstViol) { firstViol = true; mark('violation', { tickets }); }
    if (mode === 'off' && paid !== lastPaid) { lastPaid = paid; mark('paid', { paid, tickets }); await cap(`It acts on its new rules: <b>${paid}</b> paid out against the original policy.`); }
    if (mode === 'on' && q > lastQ) { lastQ = q; mark('quarantine', { q, tickets }); await cap(`Rule weakened, so instructions are <b>rolled back</b> before a bad refund goes out. Quarantines: ${q}. Paid against policy: <b>${await stat('Paid out against policy')}</b>`); }
    const running = await p.getByRole('button', { name: 'Stop' }).count();
    if (tickets >= N && !running) break;
    if ((Date.now() - t0) > 15 * 60 * 1000) { mark('timeout'); break; }
  }
  const paid = await stat('Paid out against policy');
  mark('done', { paid, viol: await p.locator('.tag.viol').count(), q: await p.locator('.alert.quarantine').count() });
  await cap(mode === 'on' ? `25 tickets. Paid out against policy: <b>${paid}</b>.` : `25 tickets. Nobody changed its prompt. It did. Paid against policy: <b>${paid}</b>.`);
  await p.locator('pre.playbook').scrollIntoViewIfNeeded();
  await p.waitForTimeout(9000); mark('end');
  const video = p.video(); await ctx.close(); await b.close();
  const path = await video.path(); fs.renameSync(path, `run_${mode}.webm`);
  fs.writeFileSync(`events_${mode}.json`, JSON.stringify(events, null, 1));
})();
