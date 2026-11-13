process.env.FIXO_JOB_TEST_MODULE='sprint04';
process.env.FIXO_PAYMENT_TESTS='1';
await import('./test-marketplace-postgres.mjs');
