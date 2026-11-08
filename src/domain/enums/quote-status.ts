export const QUOTE_STATUSES = ["draft", "submitted", "accepted", "rejected", "withdrawn", "expired"] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["accepted", "rejected", "withdrawn", "expired"],
  // accepted es un estado contractual: no puede volver a ser editable sin un flujo administrativo explícito.
  accepted: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

export function canTransitionQuote(current: QuoteStatus, next: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[current].includes(next);
}

export function availableQuoteTransitions(status: QuoteStatus): readonly QuoteStatus[] {
  return QUOTE_TRANSITIONS[status];
}
