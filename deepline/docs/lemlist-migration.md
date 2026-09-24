# Smartlead/Instantly → Lemlist Migration Guide

For Deepline users migrating from Smartlead or Instantly to Lemlist.

## Why Lemlist for Deepline users?

| Feature | Smartlead | Instantly | Lemlist |
|---|---|---|---|
| API rate limit | 60 req/min | 60 req/min | **120 req/min** (2x faster) |
| HubSpot native integration | Basic webhook | Basic webhook | **Native CRM sync** |
| Warmup network | Included | Included | Included |
| Price (10 inboxes) | $39/mo | $37/mo | $59/mo |
| Price (unlimited) | $94/mo | $147/mo | $99/mo |
| Deepline Customer DB support | Via custom scripts | Via custom scripts | **Native HubSpot → Customer DB** |

**Verdict:** Lemlist is slightly more expensive at small scale, but the 2x API rate limit + native HubSpot integration makes it the better choice for Deepline + HubSpot users.

## API mapping

### Authentication

| Platform | Auth Method |
|---|---|
| Smartlead | `X-API-Key: YOUR_KEY` header |
| Instantly | `Authorization: Bearer YOUR_KEY` header |
| **Lemlist** | **`:YOUR_KEY@` in URL** (HTTP Basic Auth style) |

**Lemlist curl example:**
```bash
curl "https://:${LEMLIST_API_KEY}@api.lemlist.com/api/team"
```

### Campaign creation

| Field | Smartlead | Instantly | Lemlist |
|---|---|---|---|
| Campaign ID type | UUID | String | String |
| Subject line | `subject` | `subject` | `emailTemplate.subject` |
| Body | `message` | `body` | `emailTemplate.body` |
| Variable syntax | `{{variable}}` | `{{variable}}` | `{{variable}}` |
| Spintax syntax | `{opt1\|opt2}` | `{opt1\|opt2}` | `{opt1\|opt2}` |

**Smartlead:**
```json
{
  "campaign_name": "Q4 Campaign",
  "subject": "{{company}} + Acme",
  "message": "Hi {{first_name}},\n\n{{funding_line}}"
}
```

**Lemlist:**
```json
{
  "name": "Q4 Campaign",
  "emailTemplate": {
    "subject": "{{companyName}} + Acme",
    "body": "Hi {{firstName}},\n\n{{funding_line}}"
  }
}
```

### Add leads

| Field | Smartlead | Instantly | Lemlist |
|---|---|---|---|
| Endpoint | `POST /campaigns/{id}/leads` | `POST /campaigns/{id}/leads` | `POST /api/campaigns/:id/leads` |
| Lead email field | `email` | `email` | `email` |
| First name field | `first_name` | `first_name` | `firstName` (camelCase) |
| Last name field | `last_name` | `last_name` | `lastName` (camelCase) |
| Company field | `company` | `company` | `companyName` |
| Custom fields | `variables` object | `variables` object | `customFields` object |
| Dedupe | Manual | Manual | **Auto (per campaign)** |

**Smartlead:**
```json
{
  "email": "prospect@company.com",
  "first_name": "John",
  "last_name": "Doe",
  "variables": {
    "funding_line": "Saw you raised $52M in the Series B."
  }
}
```

**Lemlist:**
```json
{
  "email": "prospect@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "customFields": {
    "funding_line": "Saw you raised $52M in the Series B."
  }
}
```

### Fetch replies

| Platform | Endpoint | Filter param |
|---|---|---|
| Smartlead | `GET /campaigns/{id}/replies` | N/A (campaign-scoped) |
| Instantly | `GET /campaigns/{id}/replies` | N/A (campaign-scoped) |
| **Lemlist** | **`GET /api/activities?type=replied`** | `campaignId` param |

**Lemlist fetch all replies:**
```bash
curl "https://:${LEMLIST_API_KEY}@api.lemlist.com/api/activities?type=replied&limit=100&offset=0"
```

**Lemlist fetch replies for one campaign:**
```bash
curl "https://:${LEMLIST_API_KEY}@api.lemlist.com/api/activities?type=replied&campaignId=abc123"
```

### Unsubscribe

| Platform | Endpoint |
|---|---|
| Smartlead | `POST /leads/{id}/unsubscribe` |
| Instantly | `POST /leads/{id}/unsubscribe` |
| **Lemlist** | **`POST /api/campaigns/:id/leads/:email/unsubscribe`** |

**Lemlist:**
```bash
curl -X POST "https://:${LEMLIST_API_KEY}@api.lemlist.com/api/campaigns/abc123/leads/prospect@company.com/unsubscribe"
```

## Warmup settings

| Field | Smartlead | Instantly | Lemlist |
|---|---|---|---|
| Enable/disable | `warmup_enabled` (string "true"/"false") | `warmupEnabled` (boolean) | `warmupEnabled` (boolean) |
| Max per day | `total_warmup_per_day` | `warmupMaxPerDay` | `warmupMaxPerDay` |
| Daily rampup | `daily_rampup` | `warmupDailyRampup` | `warmupDailyRampup` |
| Reply rate | `reply_rate_percentage` | `warmupReplyRate` | `warmupReplyRate` |

**Smartlead:**
```json
{
  "warmup_enabled": "true",
  "total_warmup_per_day": 40,
  "daily_rampup": 5,
  "reply_rate_percentage": "20"
}
```

**Lemlist:**
```json
{
  "warmupEnabled": true,
  "warmupMaxPerDay": 40,
  "warmupDailyRampup": 5,
  "warmupReplyRate": 20
}
```

## Rate limits

| Platform | Requests per minute |
|---|---|
| Smartlead | 60 |
| Instantly | 60 |
| **Lemlist** | **120** (2x faster) |

**For bulk uploads:**
- Smartlead/Instantly: batch 100 leads per request, wait 1 second between batches
- Lemlist: batch 100 leads per request, **no wait needed** (120 req/min headroom)

## Migration checklist

### 1. Export existing campaigns

**From Smartlead:**
```bash
curl -H "X-API-Key: $SMARTLEAD_API_KEY" "https://api.smartlead.ai/campaigns" > smartlead-campaigns.json
```

**From Instantly:**
```bash
curl -H "Authorization: Bearer $INSTANTLY_API_KEY" "https://api.instantly.ai/campaigns" > instantly-campaigns.json
```

### 2. Convert campaign JSON

Field mappings:
- `first_name` → `firstName`
- `last_name` → `lastName`
- `company` → `companyName`
- `variables` → `customFields`
- Smartlead's `warmup_enabled: "true"` (string) → Lemlist's `warmupEnabled: true` (boolean)

### 3. Recreate campaigns in Lemlist

```bash
curl -X POST "https://:${LEMLIST_API_KEY}@api.lemlist.com/api/campaigns" \
  -H "Content-Type: application/json" \
  -d @converted-campaign.json
```

### 4. Upload leads to Lemlist

Convert CSV columns:
```python
import pandas as pd

# Read Smartlead export
df = pd.read_csv('smartlead-leads.csv')

# Rename columns for Lemlist
df = df.rename(columns={
    'first_name': 'firstName',
    'last_name': 'lastName',
    'company': 'companyName'
})

# Move custom fields into nested object
custom_cols = ['funding_line', 'new_in_role_line', 'engagement_line']
df['customFields'] = df[custom_cols].to_dict('records')
df = df.drop(columns=custom_cols)

# Export
df.to_csv('lemlist-leads.csv', index=False)
```

Upload:
```bash
npx tsx lemlist-upload.ts --campaign-id=abc123 --csv=lemlist-leads.csv
```

### 5. Migrate warmup settings

Run `/lemlist-inbox-manager`:
```bash
npx tsx set-warmup.ts --mode=enable --all
npx tsx set-signatures.ts --all
```

### 6. Update Deepline plays

Change environment variable:
```bash
# .env.deepline
# Old:
# SMARTLEAD_API_KEY=your_smartlead_key

# New:
LEMLIST_API_KEY=your_lemlist_key
```

Update campaign upload scripts:
```typescript
// Old: skills/smartlead-campaign-upload-public/upload.ts
// New: deepline/skills/lemlist-campaign-upload/upload.ts

// Change API endpoint
const BASE_URL = `https://:${process.env.LEMLIST_API_KEY}@api.lemlist.com`;

// Update field names
const lead = {
  email: row.email,
  firstName: row.first_name,  // Note: still snake_case in CSV, rename in code
  lastName: row.last_name,
  companyName: row.company,
  customFields: {
    funding_line: row.funding_line,
    new_in_role_line: row.new_in_role_line,
  },
};
```

### 7. Test with pilot campaign

Before full migration:
1. Create one pilot campaign in Lemlist
2. Upload 10 test leads
3. Verify variables render correctly
4. Check unsubscribe link appears
5. Confirm warmup is ramping

### 8. Deprecate Smartlead/Instantly

Only after pilot succeeds:
1. Pause all Smartlead/Instantly campaigns
2. Export final reply data
3. Cancel Smartlead/Instantly subscription
4. Keep API keys for 30 days (historical data access)

## Cost comparison

| Scale | Smartlead | Instantly | Lemlist |
|---|---|---|---|
| 10 inboxes | $39/mo | $37/mo | $59/mo |
| 40 inboxes | $94/mo | $147/mo | $99/mo |
| 100+ inboxes | $94/mo | $297/mo | $99/mo |

**Break-even:** Lemlist is cheaper at 40+ inboxes.

## HubSpot sync (Lemlist native advantage)

Lemlist → HubSpot native integration:
1. Connect HubSpot in Lemlist UI (Settings → Integrations)
2. Enable bidirectional sync
3. Map custom fields: `funding_line` → HubSpot property `funding_line__c`
4. Replies/opens/unsubscribes auto-sync to HubSpot activity timeline

**Deepline Customer DB:**
- HubSpot is now the CRM truth (not Supabase)
- Customer DB reads from HubSpot via native API
- No custom sync scripts needed

## Troubleshooting

### "Unauthorized" (401) errors

Lemlist auth is `:KEY@` in URL, not header. Common mistakes:
- Missing `:` before key
- Using `Authorization: Bearer` header (that's Instantly)
- Using `X-API-Key` header (that's Smartlead)

### Variables not rendering

Check field name casing:
- Smartlead: `{{first_name}}` (snake_case)
- Lemlist: `{{firstName}}` (camelCase)

### Dedupe not working

Lemlist auto-dedupes **per campaign** only. Same email in two campaigns = two sends.

To dedupe across campaigns: export all leads, dedupe in CSV, re-upload.

### Rate limit errors

Lemlist allows 120 req/min vs Smartlead/Instantly 60 req/min.

If still hitting limits: batch leads into 100 per request, add 0.5-second delay.

## Support

- Lemlist API docs: https://developer.lemlist.com/
- Lemlist support: https://help.lemlist.com/
- Deepline port questions: Open GitHub issue with `[lemlist-migration]` prefix

## References

- Original Smartlead skill: `skills/smartlead-api/SKILL.md`
- Lemlist inbox manager: `deepline/skills/lemlist-inbox-manager/SKILL.md`
- Lemlist API reference: `deepline/skills/lemlist-api/SKILL.md`
- Deepline port mapping: `deepline/PORT.md`
