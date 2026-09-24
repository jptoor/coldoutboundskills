---
name: lemlist-inbox-manager
description: Programmatic inbox management for Lemlist. Enable/disable warmup with correct ramp settings, set signatures in bulk, tag inboxes (active vs insurance), and monitor inbox health. Use after creating a new batch of inboxes via Zapmail domain setup, or when managing an existing Lemlist account at scale. Triggers on "turn on warmup", "set signatures", "tag inboxes", "inbox health", "set up new inboxes".
---

# Lemlist Inbox Manager

**Deepline port of `smartlead-inbox-manager` adapted for Lemlist API.**

Zapmail hands you hundreds of new inboxes. Lemlist needs them configured: warmup enabled with the right ramp, signatures set so emails don't look bare, tags applied so you know which are active vs insurance, and health monitored so dead inboxes get recycled.

This skill does all of that via the Lemlist API.

## Core operations

| Operation | What it does | Lemlist API endpoint |
|---|---|---|
| Enable warmup | Turns on warmup with correct ramp (start 1/day, +5/day up to 40/day) | `PATCH /api/team` |
| Disable warmup | Turns off warmup (use for insurance inboxes) | `PATCH /api/team` |
| Set signatures | Bulk-applies a signature template to sender accounts | `PATCH /api/team` |
| Tag as active | Adds the "active" tag to sender | `PATCH /api/team` |
| Tag as insurance | Adds the "insurance" tag to sender | `PATCH /api/team` |
| Health dashboard | Lists all senders with warmup status, health score | `GET /api/team` |

## Active vs insurance (the tagging convention)

Not every inbox should send all the time. A common pattern:

- **Active inboxes** — currently sending in live campaigns. Warmup OFF (or minimal) to prioritize real sends.
- **Insurance inboxes** — warmed but idle, held in reserve. Warmup ON to maintain reputation. Swap in when an active inbox burns out.

Tags are how you track this at scale. Lemlist supports custom tags on sender accounts.

## Inputs

Every script reads:
- `LEMLIST_API_KEY` (env var)
- Inbox selector: `--sender-emails=email1@domain.com,email2@domain.com` OR `--domain=example.com` OR `--tag=insurance` OR `--all`
- Operation-specific flags (see each script)

## Warmup ramp settings

### Default warmup config for a NEW inbox (week 1-4 of warmup period)

Lemlist warmup settings:

```json
{
  "warmupEnabled": true,
  "warmupMaxPerDay": 40,
  "warmupDailyRampup": 5,
  "warmupReplyRate": 20
}
```

- `warmupMaxPerDay`: max emails/day the inbox sends in warmup network (peak)
- `warmupDailyRampup`: increment per day (day 1 = 1, day 2 = 6, day 3 = 11, etc. up to the cap)
- `warmupReplyRate`: how often warmup peers reply (20% is realistic)

### For INSURANCE inboxes (maintaining reputation long-term)

```json
{
  "warmupEnabled": true,
  "warmupMaxPerDay": 15,
  "warmupDailyRampup": 0,
  "warmupReplyRate": 20
}
```

Lower volume, no ramp — just keeps the inbox warm.

### For ACTIVE inboxes (currently in live campaigns)

```json
{
  "warmupEnabled": false
}
```

Warmup off so the daily send budget goes to real prospects.

## Signature template

The default template, applied in bulk via `set-signatures.ts`, is:

```
{firstName} {lastName}
{title}
{company}
{address}
```

Rendered (for example):

```
Jane Smith
Founder
Acme
123 Main St, Suite 400, Austin, TX 78701
```

**Where each value comes from:**
- `{firstName}` `{lastName}` — the sender account's own name fields if set, else `SENDER_FIRST_NAME + SENDER_LAST_NAME` from `.env`
- `{title}` — `SENDER_TITLE` env var
- `{company}` — `SENDER_COMPANY_NAME` env var
- `{address}` — `SENDER_PHYSICAL_ADDRESS` env var (recommended — a real mailing address in the footer keeps you on the right side of CAN-SPAM and similar rules)

**Variables are interpolated at send time**, so different personas can share one signature template (they just set their own `firstName`, `title`, etc. per sender account).

## Lemlist API differences vs Smartlead

| Feature | Smartlead | Lemlist | Notes |
|---|---|---|---|
| API auth | `X-API-Key` header | `:LEMLIST_API_KEY@` in URL | Lemlist uses HTTP Basic Auth style |
| Inbox ID type | Integer IDs | Email addresses | Lemlist identifies senders by email |
| Warmup endpoint | `POST /email-accounts/{id}/warmup` | `PATCH /api/team` (bulk sender settings) | Lemlist warmup is team-level config |
| Signature endpoint | `POST /email-accounts/{id}/settings` | `PATCH /api/team` (sender signature field) | Same endpoint as warmup |
| Health metrics | `GET /email-accounts` | `GET /api/team` | Lemlist returns `emailWarmup` object per sender |
| Rate limits | 60 req/min | 120 req/min | Lemlist is 2x more permissive |

## Scripts

### `set-warmup.ts`

Enable or disable warmup for selected inboxes.

```bash
# Enable warmup on all inboxes at example.com
npx tsx set-warmup.ts --mode=enable --domain=example.com

# Disable warmup on specific inboxes
npx tsx set-warmup.ts --mode=disable --sender-emails=inbox1@example.com,inbox2@example.com

# Enable warmup with custom settings (insurance tier)
npx tsx set-warmup.ts --mode=enable --tag=insurance --max-per-day=15 --rampup=0
```

### `set-signatures.ts`

Apply signature template to all selected inboxes.

```bash
# Set signatures on all inboxes
npx tsx set-signatures.ts --all

# Set signatures on one domain
npx tsx set-signatures.ts --domain=example.com

# Custom signature template
npx tsx set-signatures.ts --all --template="{{firstName}} {{lastName}}\n{{company}}"
```

### `tag-inboxes.ts`

Tag inboxes as "active" or "insurance".

```bash
# Tag as active
npx tsx tag-inboxes.ts --tag=active --sender-emails=inbox1@example.com,inbox2@example.com

# Tag all at a domain as insurance
npx tsx tag-inboxes.ts --tag=insurance --domain=backup.example.com
```

### `list-health.ts`

Pull health dashboard: all senders with warmup status, health score, daily sent, bounces.

```bash
# List all inboxes
npx tsx list-health.ts --all

# List only inboxes with issues (low health score)
npx tsx list-health.ts --all --issues-only

# Export to CSV
npx tsx list-health.ts --all --out=inbox-health.csv
```

## Lemlist warmup health signals

Lemlist's `GET /api/team` response includes per-sender warmup health:

```json
{
  "senderEmail": "inbox1@example.com",
  "emailWarmup": {
    "enabled": true,
    "status": "active",
    "score": 85,
    "dailySent": 32,
    "bounceRate": 0.5,
    "complaintRate": 0.0
  }
}
```

**Health score interpretation:**
- `90-100`: Excellent. Keep sending.
- `80-89`: Good. Monitor daily.
- `70-79`: Borderline. Reduce volume or pause.
- `< 70`: Poor. Disable and investigate (SPF/DKIM/DMARC, spam traps, blacklists).

**When to recycle an inbox:**
- Health score drops below 70 for 3+ consecutive days
- Bounce rate > 5% (hard bounces)
- Complaint rate > 0.1% (spam reports)
- Lemlist marks status as `"suspended"` or `"error"`

## Onboarding flow (new batch of inboxes)

After creating inboxes via Zapmail:

1. **Add to Lemlist** — manually add sender accounts in Lemlist UI or via `POST /api/team` (one-time)
2. **Enable warmup** — `npx tsx set-warmup.ts --mode=enable --domain=newdomain.com`
3. **Set signatures** — `npx tsx set-signatures.ts --domain=newdomain.com`
4. **Tag as insurance** — `npx tsx tag-inboxes.ts --tag=insurance --domain=newdomain.com`
5. **Wait 21 days** — let warmup ramp naturally (1/day → 40/day over 3 weeks)
6. **Switch to active** — when you launch a campaign, re-tag as active and disable warmup

## HubSpot integration (optional)

Deepline Customer DB can track inbox lifecycle via HubSpot custom properties:

- `inbox_email` — sender email
- `inbox_domain` — domain
- `inbox_status` — "warmup" | "active" | "insurance" | "recycled"
- `inbox_health_score` — Lemlist health score (synced daily)
- `inbox_created_at` — when inbox was provisioned
- `inbox_last_checked` — last health check timestamp

Sync script: `sync-to-hubspot.ts` (runs daily via cron or Deepline scheduled play).

## Cost comparison: Smartlead vs Lemlist

| Tier | Smartlead | Lemlist | Notes |
|---|---|---|---|
| Starter (10 inboxes) | $39/mo | $59/mo | Lemlist slightly more expensive |
| Pro (unlimited inboxes) | $94/mo | $99/mo | Comparable |
| Warmup network | Included | Included | Both have native warmup |
| API rate limits | 60 req/min | 120 req/min | Lemlist 2x faster |
| CRM integrations | Basic | HubSpot native | Lemlist advantage for HubSpot users |

**For Deepline users:** Lemlist's HubSpot native integration + 2x rate limit makes it the better choice when HubSpot is the CRM truth.

## Environment variables

Add to `.env.deepline`:

```bash
# Lemlist API (required)
LEMLIST_API_KEY=your_lemlist_api_key

# Sender signature defaults
SENDER_FIRST_NAME="Jane"
SENDER_LAST_NAME="Smith"
SENDER_TITLE="Founder"
SENDER_COMPANY_NAME="Acme Inc"
SENDER_PHYSICAL_ADDRESS="123 Main St, Suite 400, Austin, TX 78701"

# Optional: HubSpot sync
HUBSPOT_API_KEY=your_hubspot_key
```

## Lemlist API reference

Full Lemlist API docs: https://developer.lemlist.com/

Key endpoints for inbox management:

- `GET /api/team` — List all sender accounts with warmup health
- `PATCH /api/team` — Update sender settings (warmup, signature, tags)
- `POST /api/team` — Add new sender account
- `DELETE /api/team/:email` — Remove sender account
- `GET /api/activities` — Fetch send/open/reply/bounce activities

## Troubleshooting

### "Unauthorized" (401) errors

Lemlist API auth is HTTP Basic Auth style: `https://:LEMLIST_API_KEY@api.lemlist.com/...`

The `:` before the API key is required (empty username).

### Warmup not ramping

Check `emailWarmup.status` in `GET /api/team` response:
- `"active"` — warmup is running
- `"paused"` — manually paused
- `"error"` — SPF/DKIM/DMARC issue or Lemlist detected a problem

### Signature not rendering variables

Lemlist signature variables use double curly braces: `{{firstName}}`, not `{firstName}`.

Update template: `--template="{{firstName}} {{lastName}}\n{{company}}"`

### Rate limit (429) errors

Lemlist allows 120 req/min. Batch updates to stay under limit:
- Update 100 inboxes at once (one bulk `PATCH /api/team` with array of sender emails)
- Add 1-second delay between batches

## Next steps

After inbox management:
1. Run `/deliverability-audit` skill to verify SPF/DKIM/DMARC
2. Launch first campaign via `/lemlist-campaign-upload` skill
3. Monitor reply rates via `/reply-scoring` skill
4. Establish `/weekly-rhythm` for ongoing ops

## References

- Original skill: `skills/smartlead-inbox-manager/SKILL.md`
- Lemlist API docs: https://developer.lemlist.com/
- Smartlead → Lemlist migration guide: `deepline/docs/lemlist-migration.md`
- Deepline port mapping: `deepline/PORT.md`
