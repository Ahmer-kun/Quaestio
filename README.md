# Welcome 

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploying to Vercel

The frontend is a TanStack Start app (Nitro, `vercel` preset) and the backend is a plain
Supabase project. A production build writes `.vercel/output`, which Vercel serves directly.

### Environment variables

Add these in Vercel under **Project → Settings → Environment Variables** (no real values are
committed here; copy them from your Supabase project's **API settings** and from `.env`):

| Variable | Where it is used |
| --- | --- |
| `VITE_SUPABASE_URL` | Browser + server Supabase client URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser + server Supabase publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Project reference, used by the server entry |
| `SUPABASE_URL` | Server-side Supabase URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side Supabase publishable key |

### Settings

- **Node.js 22.x** — set the project Node version to 22.x (Build & Deployment → Node.js Version).
- **Supabase Authentication → URL Configuration** — add your Vercel domain (e.g.
  `https://your-app.vercel.app`) to **Site URL / Redirect URLs**, so auth redirects and confirmations
  land on the deployed app instead of `localhost`.
- **Supabase Authentication → Providers → Email** — turn off **Confirm email**. Accounts are created
  from a username alone (there is no inbox to confirm against), and signup must hand back a session
  immediately.

### Deploy

```sh
VERCEL=1 npx vite build   # writes .vercel/output locally
npx nitro deploy --prebuilt
```

Or connect the repository in Vercel and let it run the same build on every push.

### Database

Migrations live in `supabase/migrations/`. Apply pending ones with `supabase db push`, or paste the
SQL into the Supabase **SQL Editor**.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
