# birthday ♡ advent calendar

A countdown to Nov 28: a fine-line illustrated building with 11 windows. Each
day I ship one small build (a "door"), and its window lights up. Pushes to
GitHub light windows live, through a signed webhook and Supabase Realtime.

```
apps/web/                 Next.js (App Router) site
  app/page.tsx            the building (server: unlock rules, sky, door data)
  app/door/[n]/           one page per door (sealed until its date, server-side)
  app/api/github/webhook/ GitHub push → light a window
  components/building/    scene: façade, windows, sky, elevator, fireworks
  lib/                    unlock rules (IST), sky (Open-Meteo), webhook helpers
packages/garden-ui/       shared tokens, motion presets, DoorFrame
supabase/migrations/      schema, RLS, seed, record_push()
```

## Run it locally

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then set DEV_UNLOCK_ALL=true
pnpm dev                                       # http://localhost:3000
```

Without Supabase configured the calendar still renders (every window empty).
Local-only preview switches (need `DEV_UNLOCK_ALL=true`, ignored in production):

| URL | Shows |
|---|---|
| `/?preview=mixed` | some windows pushed / shipped |
| `/?preview=finale` | Nov 28: every lamp, fireworks |
| `/?sky=night` (`dawn`, `day`, `dusk`), `&rain=1` | force the sky |

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **SQL Editor → New query**, paste all of
   [`supabase/migrations/20261117000000_init.sql`](supabase/migrations/20261117000000_init.sql), run it.
   (Or with the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe in the browser: RLS only allows reads)
   - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (**server only**, never prefix with `NEXT_PUBLIC_`)

## 2. Vercel

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new).
2. **Root Directory:** `apps/web` (Vercel detects the pnpm workspace).
3. **Environment variables:** the three Supabase values above, plus
   `GITHUB_WEBHOOK_SECRET` (generate one below). Don't set `DEV_UNLOCK_ALL`.
4. Deploy. Every push to `main` redeploys.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. GitHub webhook

On each repo whose pushes should light windows (this one, and the LeetCode
solutions repo if you like): **Settings → Webhooks → Add webhook**

- **Payload URL:** `https://<your-vercel-domain>/api/github/webhook`
- **Content type:** `application/json`
- **Secret:** the same `GITHUB_WEBHOOK_SECRET`
- **Events:** just the push event

GitHub immediately sends a `ping`; **Recent Deliveries** should show `200 {"ok":true,"pong":true}`.

**How windows light up** (all decided on the server, in IST):

- Any branch push on a door's day → that window's lamp turns on (`sprouted_at`).
- A commit message containing `door:N` → door N ships (`shipped_at`), but only on or after its date.
- Open browsers update within a second (Supabase Realtime).

> Heads-up: because `door:N` in a commit message ships a door, only write it in
> the commit that actually ships that door.

## How the webhook stays safe

- **Signed:** every delivery is checked with HMAC-SHA256 over the raw body,
  compared in constant time. Unsigned or wrong requests get `401`.
- **Idempotent:** `X-GitHub-Delivery` is a unique key. Redelivering the same
  event is a no-op, so "Redeliver" in GitHub is always safe.
- **Atomic:** dedupe + sprout + ship happen in one Postgres function
  (`record_push`), so a crash can't leave a half-recorded push.
- **Least privilege:** the public key can only read; only the server's
  service-role key can call `record_push`.
