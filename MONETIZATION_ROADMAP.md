# PixSqueeze — Monetization Roadmap

> Note: superseded in part by the Alosha Studio roadmap. PixSqueeze is now an Alosha product at pixsqueeze.alosha.dev.

## Implementation status — November 2, 2026

The current working tree adds the following to the open-source package and repository demo:

- `PixSqueeze.compress(file, options)` with Promise results, byte-size targets, bounded quality search, optional resizing, cancellation, and timeouts.
- Explicit HEIC/TIFF/RAW conversion endpoints and request options; ordinary supported image processing stays in the browser. RAW conversion depends on installed codecs.
- TypeScript declarations and native ESM/CommonJS package entries, with the callback constructor retained.
- A local playground with previews, downloads, target feedback, and opt-in server uploads.
- Browser, server, package-consumer, and playground verification in the local release command and CI configuration.

See the [README](README.md) and [1.5.0 changelog](CHANGELOG.md) for the implemented contracts. The 1.5.0 release covers the package and repository demo; hosted-site deployment is verified separately. The batch service is a separate project; the new browser options do not establish its feature support.

The original phases below are planning history. Their timelines, pricing, provider suggestions, and market assumptions are not current release commitments or verified service specifications.

## The Strategy in One Sentence

Publish a free, open-source npm package for single-image compression (including HEIC/TIFF) to drive developer traffic, then convert them to a paid API for batch processing — with mobile apps as a later expansion.

---

## Phase 1 — Open Source npm Package (0–4 weeks)

**Goal:** Establish presence, attract developers, build trust.

### What to ship
- Make the repo public on GitHub
- Publish the scoped npm package as `@alosha/pixsqueeze`
- Browser JPEG/PNG/WebP compression, plus explicit server-assisted TIFF/HEIC conversion and codec-dependent RAW handling
- Browser-side JS + optional Node server for HEIC/TIFF

### What stays free forever
- Single image at a time
- All format support (HEIC, TIFF, WebP, JPEG, PNG)
- Full source code (MIT license)

### Why this works
- Developers hit HEIC conversion pain constantly (iPhone photos). Very few npm packages handle it cleanly in a Node server context.
- Stars and npm downloads become social proof for the paid tier.
- README becomes a landing page until you have a real domain.

### What to do in the README
- Lead with **HEIC and TIFF support** — that's the hook
- Add a clear banner: *"Need batch processing? → [PixSqueeze API](#)"* (link to waitlist/email for now)
- Add a GitHub Sponsors button to monetize early adopters even before the API is live

---

## Phase 2 — Paid API for Batch Processing (4–12 weeks)

**Goal:** First revenue. Convert npm users into paying API customers.

### Core difference from the free package
| Feature | Free npm | Paid API |
|---|---|---|
| Images at once | 1 | Up to 1,000 |
| Formats | HEIC, TIFF, PNG, JPEG, WebP | Same + AVIF |
| Processing | Browser; explicitly configured conversion server for special formats | Separate hosted service |
| Price | Free | Usage-based |

### Hosting (since you have no domain yet)

You don't need to buy infrastructure. Start with:

- **[Railway.app](https://railway.app)** — deploy your Express server from GitHub in minutes. Free trial, then ~$5/mo. No DevOps knowledge needed. Gives you a `*.railway.app` subdomain immediately.
- **[Render.com](https://render.com)** — similar, free tier available, auto-deploys from GitHub.
- **[Fly.io](https://fly.io)** — more powerful, generous free tier, great for Node apps.

Get a domain when you have paying customers. Until then, a `*.up.railway.app` subdomain works fine for an API.

### Billing
- Use **[Stripe](https://stripe.com)** with Metered Billing
- Charge per image processed, e.g.:
  - **Free**: 100 images/month (requires API key, no credit card)
  - **Starter** $9/mo: 2,000 images
  - **Pro** $29/mo: 20,000 images
  - **Business** $99/mo: unlimited
- Stripe's metered billing handles the counting automatically

### What to build (in order)
1. API key generation endpoint (`POST /auth/register` → returns key)
2. Middleware that validates key + counts usage
3. Batch endpoint: `POST /compress/batch` (accepts array of files)
4. Simple usage dashboard (even a plain JSON endpoint works at first: `GET /usage`)
5. Stripe webhook to upgrade/downgrade limits based on subscription

### Recommended stack additions
- **Redis** (free tier on Upstash) — for usage counters per API key
- **Prisma + PostgreSQL** (free tier on Supabase) — for storing keys and customer records

---

## Phase 3 — Mobile Apps (3–6 months out)

**Goal:** Expand to non-developer users. Bigger market, higher willingness to pay.

### Why React Native makes sense for you
- You're already in JavaScript
- Single codebase → iOS + Android
- Can reuse your compression logic (the browser-side part of your library)
- The server-side HEIC conversion can be called from the app via your API

### App concept
**PixSqueeze Mobile** — drag, compress, share.
- User picks image(s) from camera roll (including HEIC from iPhone)
- App compresses locally for small files, calls your API for batch/TIFF
- Output: saves back to camera roll or shares directly

### Monetization for mobile
- **Free**: 5 compressions/day
- **Pro** ($2.99/mo or $14.99/year): unlimited, plus batch mode
- Use **RevenueCat** to manage subscriptions across iOS and Android — it handles App Store and Play Store billing in one SDK

### iOS-specific advantage
HEIC is Apple's default photo format. iPhone users are the largest single group with HEIC files who don't know how to open them elsewhere. An iOS app that "fixes" their photos for sharing is a natural fit and a clear App Store search keyword.

---

## Sequencing Summary

```
Now          Month 1         Month 3         Month 6
  │               │               │               │
  ▼               ▼               ▼               ▼
Make repo     Publish npm    Launch API      Mobile app
public        package        + billing       (React Native)
              (free,         on Railway      iOS first
              HEIC/TIFF)     or Render
```

---

## Quick Wins This Week

1. **Make the GitHub repo public** — costs nothing, starts building SEO and credibility
2. **Publish to npm** — `npm publish --access public`
3. **Add a GitHub Sponsors profile** — even $5/mo from early fans validates demand
4. **Set up a Railway account** — deploy your server to get a public API URL, even if you don't charge for it yet
5. **Create a waitlist** — a simple Tally or Typeform "Get notified when batch API launches" in the README, so you know who to email on launch day

---

## Competitive Positioning

Suggested positioning aligned with the repository implementation:

> **Compress images in the browser, aim for an upload size, and use explicit server conversion for HEIC, TIFF, and supported RAW files.**

Avoid claiming exclusive market support or native browser HEIC decoding. Describe the upload boundary, optional server dependency, and codec limits consistently with the README.
