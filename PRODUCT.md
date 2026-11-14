# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
**Primary (guides design decisions):** the customer. A homeowner or tenant in Chile who needs a repair or service at home (electricity, plumbing, locksmithing, appliances, painting, and similar trades), often under time pressure, and who is wary of hiring a stranger blind. They arrive mostly on a phone.

**Secondary:** the independent technician or specialist who wants to present their experience and coverage and be reviewed before being published. An administrator (the platform team) reviews applications and manages accounts, requests and jobs.

## Product Purpose
SoyFixo is a marketplace that connects customers with trusted technicians for home services in Chile. Customers browse a directory by trade, describe what they need, receive proposals and follow each job; technicians apply, are reviewed by the team and are published only after approval. Success is a customer who can decide whom to hire with clear information, and a technician whose verified profile earns real work.

## Positioning
Verifiable trust. Every published profile has been reviewed by the SoyFixo team; the amount and conditions are agreed before work starts; and, once payments are enabled, payment is held until the job is confirmed. A plain directory of technicians cannot truthfully claim that review, agreement and (later) payment protection.

## Operating Context
Roles: customer, technician, administrator, each with its own panel. The public site lists trades, a technician directory with profiles, a how-it-works page, registration (customer and technician application) and sign-in. Production runs on Vercel with a Supabase backend; the custom domain is `www.soyfixo.cl`. The product is in a pilot stage: technicians are being onboarded and the directory is mostly empty. Flow Sandbox payments exist for validation only.

## Capabilities and Constraints
- **Enabled in the pilot:** browse trades and technician profiles; customer and technician registration; technician application with admin review; service requests, proposals and job tracking where persistence is available; administrator panels.
- **Not enabled, and must not be promised in the UI:** real payments (off; no Flow production), urgent-help dispatch ("urgencias"), public customer reviews. The pages already say so and that honesty is a product requirement.
- Language: Spanish for Chile, informal "tú" address. The product name is written "SoyFixo" (single source: `src/design-system/brand.ts`).
- Mobile first; dark theme exists; the front end is Next.js, Tailwind and a token-based design system in `src/design-system` and `src/app/globals.css`.
- Pricing shown to users is in CLP; commission and total are always itemised before payment.

## Brand Commitments
Name SoyFixo and its simple SVG mark (a rounded square with an "S"), turquoise brand colour (HSL 196 78% 34%), approved by the owner on 2026-11-13 ("same colour"). Everything else about the visual identity is open for design work, subject to the owner's request that the site must not look AI-generated.

## Evidence on Hand
No real customer reviews, case studies, testimonials, press, photographs of technicians or completed jobs, or usage figures exist yet. The directory shows only demo or pilot data. **Do not fabricate any of these** (no invented testimonials, ratings, counts such as "+1,000 technicians", logos, or stock photos presented as real people or jobs).

## Product Principles
1. Be honest about the stage: say what is available now and what is not, never imply capacity or protections that do not exist yet.
2. Make the trust mechanism visible where the decision happens: review, agreed terms and, later, protected payment.
3. Information over persuasion: a customer should be able to compare and decide with facts (trade, coverage, experience), not slogans.
4. Mobile first: the common case is one thumb, one task, a stressful moment.
5. Plain Chilean Spanish, no startup jargon.

## Accessibility & Inclusion
WCAG AA contrast in both themes, minimum 44 px touch targets on mobile, visible keyboard focus, reduced-motion respected. These are enforced by `scripts/ui/audit-ui.mjs` (browser audit) and the token contrast test.
