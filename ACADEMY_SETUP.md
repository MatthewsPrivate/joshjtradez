# JoshJTradez Academy: setup guide

This guide connects the academy to its database, so Josh can sign in on the website and be recognised as the **Owner**. It takes about 15 minutes. You only do it once.

The academy is part of the main website. Anyone can reach it from the **Academy Login** button in the header, or at `/academy/login`.

---

## 1. Create the Supabase project (database + logins)

1. Go to <https://supabase.com>, sign up, and click **New project**.
2. **Name:** `joshjtradez-academy`. **Region:** London (`eu-west-2`).
3. Choose a strong **database password** and store it in a password manager. You won't need it day to day.
4. Wait about 2 minutes for the project to finish setting up.

## 2. Create the database tables

1. In Supabase, open **SQL Editor** and click **New query**.
2. Open these files from the project's `supabase/migrations/` folder **in this order**. For each one, paste its contents into the editor and click **Run**:
   1. `20261111000000_foundation.sql`
   2. `20261111010000_course_progress_view.sql`
   3. `20261111020000_platform.sql`
   4. `20261111030000_developer_role.sql`
   5. `20261111040000_contact_submissions.sql`
   6. `20261119000000_trade_reviews.sql`
   7. `20261119010000_student_activity.sql`
   8. `20261119020000_guest_checkout.sql`
   9. `20261119030000_email_security.sql`
3. Each run should end with "Success. No rows returned".

## 3. Login settings

In Supabase, go to **Authentication**:

| Where | Setting |
|---|---|
| Sign In / Providers → Email | **Confirm email: ON.** This must stay on: it's what stops someone else claiming Josh's owner account. |
| URL Configuration → Site URL | `https://joshjtradez.vercel.app` |
| URL Configuration → Redirect URLs | add `https://joshjtradez.vercel.app/academy/auth/callback` and `http://localhost:4321/academy/auth/callback` |

**Before launch:** Supabase's built-in email sender only allows a handful of emails per hour. Set up your own SMTP sender (for example Resend or Postmark) under **Authentication → Emails → SMTP Settings**.

## 4. Copy the keys

In Supabase, go to **Project Settings → API** and copy:

- **Project URL**
- **anon / publishable key**
- **service_role / secret key**. This key gives full database access. Never share it or post it anywhere.

## 5. Add the keys to the website

**On your computer (local testing):**

1. In the project folder, copy `.env.example` to a new file named `.env`.
2. Fill it in:

   ```
   PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ACADEMY_OWNER_EMAILS=josh@his-email.com
   ACADEMY_DEVELOPER_EMAILS=your-own@email.com
   ```

3. Restart the dev server (`npm run dev`).

`.env` is already ignored by git, so the keys are never committed.

**On the live website (Vercel):**

1. Open the Vercel project and go to **Settings → Environment Variables**.
2. Add the same five variables. Mark `SUPABASE_SERVICE_ROLE_KEY` as **Sensitive**.
3. Redeploy.

Until these are set, `/academy` shows a friendly "The academy is being set up" page instead of an error.

## 6. Josh signs in as the Owner

1. Josh goes to the website, clicks **Academy Login**, then **Create an account**.
2. He signs up with **the same email** you put in `ACADEMY_OWNER_EMAILS`.
3. He clicks the confirmation link in his inbox.
4. He signs in. The website recognises the email and gives him the **Owner** and **Teacher** roles. This is recorded in the audit log. Removing an email from the setting later does not take a role away. To remove a role, delete that account's row in the `user_roles` table in Supabase.
5. After signing in he can choose between the Owner, Admin, Teacher and Student portals. The role switcher at the top right moves between them at any time.

Everyone else who signs up becomes a **Student**. Josh can give staff roles from the Owner portal (Staff / Access management).

## 7. Developer access (for the site's developer only)

The developer signs up the same way as Josh, using the email in `ACADEMY_DEVELOPER_EMAILS`, and confirms it. They then get a hidden **Developer** role. This role:

- opens a **Developer portal** (`/academy/developer`). It shows whether each setting is configured and each database migration has been applied, recent audit log entries and build information. It never shows secret values.
- can open **all four portals** for testing, with full permissions.
- is **invisible to everyone else**. Nobody else is ever offered the Developer portal, and the address refuses anyone without the role.

To remove developer access later, take the email out of `ACADEMY_DEVELOPER_EMAILS`. Then delete the `developer` row for that account from the `user_roles` table in Supabase.

---

## 8. Payments (Stripe)

Buyers pay on Stripe's own checkout page (no account needed), then choose a password on the welcome page and land in their course. Courses unlock only when Stripe confirms the payment to the server, and a full refund in Stripe removes access automatically. Card details never touch this site.

1. **Create products first.** Owner portal → **Products**: set a name, price and the course(s) it unlocks. Prices live here — nothing needs creating inside Stripe.
2. **Get the API key.** In Stripe, open **Developers → API keys** and copy the **Secret key**. Start with the *test mode* key (`sk_test_…`) and test with card `4242 4242 4242 4242`, any future date, any CVC.
3. **Add the webhook.** Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://joshjtradez.vercel.app/api/academy/payments/webhook/stripe` (use the real domain once it's live)
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
   - Copy the endpoint's **Signing secret** (`whsec_…`).
4. **Add both to Vercel** (Settings → Environment Variables, mark both **Sensitive**), then redeploy:

   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. Owner → Products shows **"Stripe connected — TEST MODE"**. Buy a course with the test card to check the whole flow.
6. **Going live:** in Stripe switch off test mode, create a second webhook with the same URL and events, and replace both variables in Vercel with the live `sk_live_…` key and the new `whsec_…` secret. Redeploy.

Discount codes: create them in Stripe → **Products → Coupons → Promotion codes**; buyers can enter them at checkout.

## 9. Emails (Resend)

The academy emails buyers a 6-digit code to confirm their email before their account is created, sends purchase and refund confirmations, emails Josh on every sale, alerts users when their account is signed in to from a new device, and alerts Josh and the developer if a Stripe payment fails to process.

**A Gmail address can't be the sender.** Email services only send from a domain you own and have verified. Use a domain (e.g. `joshjtradez.com`) as the sender and Josh's Gmail as the reply-to, so replies still land in his Gmail.

1. Buy a domain if Josh doesn't have one (any registrar, or Vercel → Domains). It can also become the website's address.
2. Create a free account at [resend.com](https://resend.com) → **Domains → Add domain** → add the DNS records it shows → wait for **Verified**.
3. **API Keys → Create** (sending access) and copy it.
4. In Vercel → Environment Variables (mark the key **Sensitive**), then redeploy:

   ```
   RESEND_API_KEY=re_...
   ACADEMY_FROM_EMAIL=JoshJTradez Academy <academy@joshjtradez.com>
   ACADEMY_REPLY_TO=josh.personal@gmail.com   # Josh's real Gmail
   CONTACT_FROM_EMAIL=JoshJTradez Website <hello@joshjtradez.com>
   ```

5. **Also use it for login emails** (sign-up confirmation, password reset): Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP with host `smtp.resend.com`, port `465`, user `resend`, password = the Resend API key, sender `academy@joshjtradez.com`. Supabase's built-in sender is heavily rate-limited and not meant for real users.

Until `RESEND_API_KEY` is set, nothing is emailed and guest buyers can set their password without the email code (so sales aren't blocked). Set it up before taking real payments.

## 10. Two-factor authentication

Anyone can turn on two-factor in **Account settings** (Google Authenticator, Microsoft Authenticator, 1Password, …). Staff accounts see a banner asking them to. To make it **mandatory for staff**, add `ACADEMY_REQUIRE_STAFF_MFA=true` in Vercel and redeploy — do this after Josh has set his up.

- In Supabase → **Authentication → Multi-Factor**, make sure **TOTP (App Authenticator)** is enabled (it is by default).
- **Lost phone:** Supabase → Authentication → Users → open the user → remove their MFA factor. They can sign in with just the password and set it up again.

### Troubleshooting

- **"That email and password don't match"**: check the email was confirmed first.
- **Josh isn't recognised as Owner**: the email in `ACADEMY_OWNER_EMAILS` must match exactly (capital letters don't matter). After changing it, restart or redeploy.
