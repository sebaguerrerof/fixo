type Env = Readonly<Record<string, string | undefined>>;

/**
 * Independent operational switches (PLAN section 11). FIXO_FLOW_MODE only selects the Flow ENVIRONMENT; it never enables anything by itself.
 * Both default to disabled and only the literal "true" enables them, so a typo or an empty value fails closed.
 * Reverting an activation = turn creation off while keeping notifications on until pending payments are resolved.
 */
export interface PaymentSwitches { readonly creationEnabled: boolean; readonly notificationsEnabled: boolean }

export function loadPaymentSwitches(env: Env = process.env): PaymentSwitches {
  const on = (v: string | undefined) => v?.trim() === "true";
  return { creationEnabled: on(env.FIXO_PAYMENTS_CREATION_ENABLED), notificationsEnabled: on(env.FIXO_PAYMENTS_NOTIFICATIONS_ENABLED) };
}
