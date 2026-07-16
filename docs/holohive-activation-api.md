# Activation Portal → HoloHive Portal (HHP): API Contract

> **Using Claude Code?** Commit this file to your repo (e.g. `docs/holohive-activation-api.md`) and kick off with:
> *"Read docs/holohive-activation-api.md. Implement the 5 `GET /api/activation/*` endpoints exactly per the JSON shapes and ground rules. Start with `/summary` (required). Use real data from our activation store; return `null` for fields we don't track yet rather than faking them. When done, run the smoke test in §11 against a live activation and paste the output."*
> Then reply to HoloHive with your answers to the four questions in §8 — those block our side.

**For:** Bolt (activation microsite owner — venicekorea.app, fogo-*, etc.)
**From:** HoloHive Portal team
**Purpose:** HHP needs to pull each activation's funnel data automatically so it stops living only on one-off Vercel report pages. Once these endpoints exist, HHP shows the numbers on the client campaign page, feeds the KOL scoring system, and pools them into the cross-client Activation Log — with zero manual entry.

---

## 1. How the integration works

- Each activation microsite exposes **5 read-only JSON endpoints** under one base URL.
- HHP stores that base URL per campaign and **polls hourly** (server-to-server; the client never hits your site directly). Results are cached in HHP — your endpoints are read whenever we refresh, never in the client's request path.
- **You provide the funnel** (entries, participants, clicks, sign-ups, wallets, volume). **HHP owns the money** (KOL payments + prize pool live in HHP). So you do **not** send any spend/cost figures — just the outcomes.

**Base URL:** you give us one per activation, e.g. `https://venicekorea.app`. HHP calls `GET {base}/api/activation/<endpoint>`.

## 2. Ground rules (all 5 endpoints)

1. **Method:** `GET`, returns `application/json`, HTTP 200 on success.
2. **No secrets in the response**, but the endpoints should be access-controlled — see §8. Content-Type must be JSON.
3. **Respond within 10 seconds** (HHP aborts after that).
4. **Numbers as JSON numbers**, not strings (`1234`, not `"1,234"`). Dates as ISO `YYYY-MM-DD`.
5. **Stable identity:** every response is for the single activation at that base URL. Include an `activation_id` (any stable string) in `summary` so we can tell two activations apart if you ever host more than one.
6. **Missing data is fine** — omit a field or return `null`. HHP renders a block only when its data is present. But once you report a number, keep reporting it (don't flip a field in and out).
7. **KOL identity:** wherever you break data down by KOL, use the KOL's **handle without the @** plus platform (`{ "handle": "cobie", "platform": "x" }`). That's how HHP matches back to its KOL Database.

---

## 3. `GET /api/activation/summary`  — REQUIRED

The headline object. **If this endpoint is missing or returns no data, HHP skips the activation entirely**, so this is the one that must exist.

HHP reads `name, type, status, start_date, end_date` into columns, `total_entries` into the entries KPI, and the funnel outcomes (`sign_ups`, `wallets`, `volume_usd`) into the **Activation Log efficiency ratios**. The `metrics[]` array powers the activation-specific cards.

```jsonc
{
  "activation_id": "venice-tradingcard-2026q2",   // stable, unique per activation
  "name": "Venice Trading Card Activation",
  "type": "trading_card",                          // free text: pfp | trading_card | frame | ...
  "status": "completed",                           // live | completed | paused
  "start_date": "2026-06-01",
  "end_date": "2026-06-21",

  // --- headline funnel (drive the Activation Log + KPI cards) ---
  "total_entries": 18342,        // total submissions/participations (may exceed unique people)
  "unique_participants": 12190,  // distinct wallets/users
  "kols_activated": 41,          // distinct KOLs who drove entries
  "sign_ups": 9021,              // NEW users who registered via the activation
  "wallets": 7440,               // wallets connected/registered
  "volume_usd": 512000,          // on-chain / trading volume attributed, in USD

  // --- activation-specific cards (render only if present) ---
  // Each becomes a labelled stat block on the client report.
  "metrics": [
    { "label": "Cards Minted",     "value": 6100, "sublabel": "82% of registered wallets" },
    { "label": "Frames Generated", "value": 3400 }
  ],

  // --- points / prizes (optional block) ---
  "prizes": {
    "draw_structure": "10 winners, weighted by entries",
    "points_by_source": [
      { "source": "referral", "points": 120000 },
      { "source": "daily_checkin", "points": 45000 }
    ]
  }
}
```

> Note: `prize_pool` amount is **not** requested here — HHP already tracks it as a payment. Just describe the draw/points structure if you want it shown.

## 4. `GET /api/activation/entries-daily`  — recommended

Time series for the "entries over time" chart.

```jsonc
{
  "series": [
    { "date": "2026-06-01", "entries": 820 },
    { "date": "2026-06-02", "entries": 1140 }
  ]
}
```

## 5. `GET /api/activation/entries-by-kol`  — recommended (feeds KOL scoring)

Per-KOL participation. **This is what flows into each KOL's Activation Impact score in HHP**, so the handle must be resolvable. `participants` (distinct people that KOL drove) is the field HHP writes onto the KOL's deliverable row.

```jsonc
{
  "kols": [
    { "handle": "cobie",   "platform": "x",        "entries": 2100, "participants": 1450 },
    { "handle": "0xfoobar","platform": "x",        "entries": 980,  "participants": 610 },
    { "handle": "somechan","platform": "telegram", "entries": 540,  "participants": 400 }
  ]
}
```

## 6. `GET /api/activation/clicks`  — recommended

Ecosystem click funnel. HHP reads `total_referrals`, `by_protocol`, and `by_source`.

```jsonc
{
  "total_referrals": 15400,
  "by_protocol": [
    { "protocol": "Jupiter", "clicks": 4200 },
    { "protocol": "Kamino",  "clicks": 2600 }
  ],
  "by_source": [
    { "source": "twitter",  "clicks": 8100 },
    { "source": "telegram", "clicks": 3900 }
  ]
}
```

## 7. `GET /api/activation/ugc`  — optional

User-generated content performance (lowest priority; safe to skip in v1).

```jsonc
{
  "items": [
    { "url": "https://x.com/user/status/123", "author": "user", "views": 40100, "likes": 900 }
  ]
}
```

---

## 8. Open decisions to confirm with Bolt

1. **Auth on the endpoints.** They expose participation/click data, so they shouldn't be world-readable. Preferred: HHP sends `Authorization: Bearer <shared-token>` and you 401 without it (HHP stores the token per campaign). Alternative: IP allowlist HHP's egress. **Which do you want?**
2. **One base URL = one activation?** If a single microsite hosts multiple activations (e.g. Fogo PFP *and* Fogo Trading Card), we need either separate base URLs or an `activation_id` query param (`?activation_id=...`). Confirm the model.
3. **Historical backfill.** For efficiency-over-time to be meaningful, past activations (Venice, Fogo) need to answer these endpoints for their already-completed runs, not just live ones. Are the finished activations still queryable?
4. **Refresh semantics.** Are these numbers final once an activation completes, or do late-settling metrics (volume) keep moving? Determines whether HHP freezes a snapshot at `status: completed`.

## 9. What HHP does NOT need from you

- Spend / cost / budget — HHP computes it from KOL payments + prize pool internally.
- KOL pricing, contracts, or PII.
- Any write access. This is strictly read-only pull.

## 10. Definition of done

Bolt: the 5 endpoints answer for at least one live activation and one completed one, per the shapes above, behind the agreed auth.
HHP: set `activation_api_base_url` on the campaign, register the hourly sync cron, and the numbers appear on the campaign report + KOL scores + Activation Log automatically.

## 11. Smoke test (run before handing back)

Replace `BASE` and `TOKEN`. Every call must return HTTP 200 + valid JSON. `/summary` must include `name`, `status`, and at least one funnel number.

```bash
BASE="https://venicekorea.app"; TOKEN="<shared-token>"
for ep in summary entries-daily entries-by-kol clicks ugc; do
  echo "== /$ep =="
  curl -sS -w "\nHTTP %{http_code}  %{time_total}s\n" \
    -H "Accept: application/json" -H "Authorization: Bearer $TOKEN" \
    "$BASE/api/activation/$ep" | head -40
done
```

Checklist:
- [ ] `/summary` returns `activation_id`, `name`, `status`, `start_date`, `end_date`, `total_entries`, and ≥1 of `sign_ups` / `wallets` / `volume_usd`.
- [ ] Every numeric field is a JSON number, not a string.
- [ ] `entries-by-kol` handles are lowercase, no `@`, with `platform`.
- [ ] Each endpoint responds in < 10s.
- [ ] Without the auth header, protected endpoints return 401 (per §8.1).
