# Bayan Investment House HR System

A complete HR management system for Bayan Investment House LLC in Muscat, Oman.

## Stack

- Next.js 16
- TypeScript
- Tailwind CSS
- shadcn/ui-style component primitives
- Firebase

## Setup

1. Clone the repository.
2. Run `npm install`.
3. Add Firebase credentials to `.env.local`.
4. Run `npm run dev`.

## ZKTeco Local Sync

This script must run on a computer in the Bayan Investment House office on the same WiFi network as the ZKTeco F18 device (`192.168.100.119`). Keep the computer on during office hours.

Run the local sync worker with:

```bash
node scripts/zkteco-local-sync.js
```

For always-on running use PM2:

```bash
npm install -g pm2
pm2 start scripts/zkteco-local-sync.js --name "zkteco-sync"
pm2 startup
pm2 save
```

## Deployment

Push to `main` to trigger CI and Vercel deployment.

## Seed

Visit `/api/seed` once after the first deploy to populate employees.
