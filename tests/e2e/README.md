# End-to-end checks

Scripts that drive a running dev server against the real Supabase project. Each
one creates throwaway `jt-…@test.invalid` accounts and deletes everything it
created at the end (users, orders, courses, notifications, audit rows).

They read keys from `.env` in the folder you run them from. Never point them at
production Stripe keys.

| Script | Covers | Needs |
| --- | --- | --- |
| `smoke.e2e.mts` | sign-in, every student/staff portal page, logo, two-factor setup → sign-in code step → access | migrations applied |
| `checkout-2fa.e2e.mts` | guest checkout, signed webhooks (bad signature, duplicates), email code (wrong / lockout / resend limit), account claim, existing-account takeover attempt, signed-in purchase, refund → access revoked, later sign-up claims purchase, two-factor | all migrations incl. `20261119020000_guest_checkout.sql`; a local mock of Stripe (built in, port 4499) |

## Run

The checkout test needs these **test-only** values in the `.env` it reads (they
make the site talk to the built-in mock instead of Stripe, and turn on the email
code step; the dummy Resend key just fails to send):

```
STRIPE_SECRET_KEY=sk_test_mock_local
STRIPE_WEBHOOK_SECRET=whsec_local_test_secret
STRIPE_API_BASE=http://localhost:4499
RESEND_API_KEY=re_test_dummy_not_real
```

Use a separate copy of the repo for this (e.g. `git worktree add ../josh-test HEAD`,
copy `.env` there and add the lines above) so your normal `.env` stays clean.

```
npx astro dev --port 4398          # in that copy
npx tsx tests/e2e/smoke.e2e.mts    # in another terminal, same folder
npx tsx tests/e2e/checkout-2fa.e2e.mts
```

Both take 1–2 minutes (two-factor waits for a fresh 30-second code window).
