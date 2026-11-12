// Drives the Flow SANDBOX checkout (and the Transbank test pages it redirects to) for ONE manifest job. Exploration-friendly: it takes screenshots
// at every step (private directory) and prints host/path plus the visible text (never tokens). Usage: node checkout.mjs <jobId> <outcome> [maxSteps]
//   outcome: approve | reject | abandon (leave the checkout open without paying)
import assert from 'node:assert/strict';
import { PROJECT_REF, readManifest } from './lib.mjs';
import { loginAs, openBrowser, startPayment } from './browser.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const shotDir = process.env.FIXO_FLOW_SHOTS, [jobId, outcome = 'approve', max = '8'] = process.argv.slice(2);
assert.ok(shotDir && jobId); const m = await readManifest(); assert.ok(m.jobs.some(j => j.id === jobId), 'el trabajo no está en el manifiesto');
const view = async (page, n) => {
  const u = new URL(page.url()); await page.screenshot({ path: `${shotDir}/${String(n).padStart(2, '0')}-${u.hostname.replace(/\W/g, '_')}.png`, fullPage: true }).catch(() => {});
  const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 450);
  console.log(`#${n} ${u.hostname}${u.pathname} :: ${text}`);
};
const browser = await openBrowser();
try {
  const { page } = await loginAs(browser, 'customer');
  await startPayment(page, jobId, shotDir); await view(page, 2);
  if (outcome === 'abandon') process.exit(0);
  for (let n = 3; n <= Number(max); n++) {
    const host = new URL(page.url()).hostname;
    if (host === 'sandbox.flow.cl') {
      const pay = page.getByRole('button', { name: /Pagar ahora/i }).or(page.getByText('Pagar ahora', { exact: true }));
      if (await pay.count()) { await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), pay.first().click()]); await page.waitForTimeout(3000); }
    } else if (host.endsWith('soyfixo.cl')) { console.log('back on Fixo'); await view(page, n); break; }
    if (new URL(page.url()).pathname.endsWith('/sendMedio.php')) {                          // Flow's "Simulador de Pagos": a select with the outcome
      const options = (await page.locator('select option').allInnerTexts()).map(t => t.trim()); console.log('simulator options: ' + JSON.stringify(options));
      const want = { approve: /pagar/i, reject: /rechaz/i, cancel: /anul|cancel/i }[outcome];
      if (!want) break; const pick = options.find(o => want.test(o)); assert.ok(pick, 'no hay opción para ' + outcome);
      await page.locator('select').selectOption({ label: pick }); console.log('simulator choice: ' + pick);
      await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), page.getByRole('button', { name: /Confirmar/i }).click()]); await page.waitForTimeout(4000);
    }
    await view(page, n);
    if (/transbank/i.test(new URL(page.url()).hostname)) break;            // stop at the bank simulator for a manual look first
  }
} finally { await browser.close(); }
