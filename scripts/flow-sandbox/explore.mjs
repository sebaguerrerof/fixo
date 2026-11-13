// Exploration step: press «Pagar» for ONE manifest job and report where the browser lands (host and path only, never the token) + screenshots.
import assert from 'node:assert/strict';
import { PROJECT_REF, readManifest } from './lib.mjs';
import { loginAs, openBrowser, startPayment } from './browser.mjs';

assert.equal(process.env.FIXO_FLOW_SANDBOX_REMOTE, PROJECT_REF);
const shotDir = process.env.FIXO_FLOW_SHOTS, jobId = process.argv[2]; assert.ok(shotDir && jobId);
const m = await readManifest(); assert.ok(m.jobs.some(j => j.id === jobId), 'el trabajo no está en el manifiesto');
const browser = await openBrowser();
try {
  const { page } = await loginAs(browser, 'customer');
  await startPayment(page, jobId, shotDir);
  const u = new URL(page.url()); console.log(JSON.stringify({ host: u.hostname, path: u.pathname, hasToken: u.searchParams.has('token') }));
  await page.screenshot({ path: shotDir + '/02-after-pay.png', fullPage: true });
  console.log((await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 700));
} finally { await browser.close(); }
