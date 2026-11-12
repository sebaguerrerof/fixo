// Browser driver for the remote Flow Sandbox run: logs in as the SYNTHETIC customer on the real site and starts a payment.
// Screenshots go to a private directory outside the repository (they may show sandbox checkout pages); nothing sensitive is printed.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { SITE, readSecrets } from './lib.mjs';

export async function openBrowser() { return chromium.launch({ channel: 'chrome', headless: true }); }

export async function loginAs(browser, label) {
  const secrets = await readSecrets(), a = secrets.accounts?.[label]; assert.ok(a && a.email.endsWith('.invalid'), 'sólo cuentas sintéticas');
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-CL' }); const page = await context.newPage();
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(SITE + '/login', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.getByPlaceholder('tu@correo.cl', { exact: true }).fill(a.email); await page.getByPlaceholder('Tu contraseña', { exact: true }).fill(a.password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    try { await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 45000 }); return { context, page }; } catch { /* retry */ }
  }
  throw new Error('login failed for ' + label);
}

/** Opens the job, accepts the consent and presses «Pagar». Resolves with the page that ends up on the provider checkout (or the in-app message). */
export async function startPayment(page, jobId, shotDir) {
  await mkdir(shotDir, { recursive: true });
  await page.goto(`${SITE}/cliente/trabajos/${jobId}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando información'), null, { timeout: 60000 }).catch(() => {});
  const form = page.locator('form', { hasText: 'Total a pagar' }); await form.waitFor({ state: 'visible', timeout: 30000 });
  await form.getByRole('checkbox').check();
  await page.screenshot({ path: `${shotDir}/01-job-before-pay.png`, fullPage: true });
  const off = u => u.hostname !== new URL(SITE).hostname;
  for (let click = 1; click <= 2; click++) {                       // a previous attempt that ended definitively asks for a second click (new idempotency key)
    await Promise.all([page.waitForURL(off, { timeout: click === 1 ? 25000 : 60000 }).catch(() => null), form.getByRole('button', { name: /Pagar/ }).click()]);
    if (off(new URL(page.url()))) break;
    await page.waitForTimeout(1500);
  }
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  return page;
}
