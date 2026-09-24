---
name: lemlist-api
description: Lemlist API reference for Deepline users. Replaces smartlead-api skill. Covers authentication, common endpoints (team/senders, campaigns, leads, activities), rate limits, and error handling.
---

# Lemlist API Reference

**Deepline port — replaces `smartlead-api` for Lemlist-based sending.**

## Authentication

Lemlist uses HTTP Basic Auth style in the URL:

```
https://:LEMLIST_API_KEY@api.lemlist.com/api/...
```

The `:` before the API key is required (empty username).

**Example curl:**
```bash
curl -X GET "https://:${LEMLIST_API_KEY}@api.lemlist.com/api/team"
```

**In TypeScript/Node:**
```typescript
const LEMLIST_API_KEY = process.env.LEMLIST_API_KEY;
const BASE_URL = `https://:${LEMLIST_API_KEY}@api.lemlist.com`;

const response = await fetch(`${BASE_URL}/api/team`);
const data = await response.json();
```

## Key endpoints

### Team & Senders

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/team` | GET | List all sender accounts with warmup health |
| `/api/team` | POST | Add new sender account |
| `/api/team` | PATCH | Update sender settings (bulk) |
| `/api/team/:email` | DELETE | Remove sender account |

### Campaigns

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/campaigns` | GET | List all campaigns |
| `/api/campaigns` | POST | Create new campaign |
| `/api/campaigns/:id` | GET | Get campaign details |
| `/api/campaigns/:id` | PATCH | Update campaign settings |
| `/api/campaigns/:id` | DELETE | Delete campaign |
| `/api/campaigns/:id/start` | POST | Start campaign |
| `/api/campaigns/:id/pause` | POST | Pause campaign |

### Leads

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/campaigns/:id/leads` | POST | Add leads to campaign (bulk) |
| `/api/campaigns/:id/leads/:email` | GET | Get lead details |
| `/api/campaigns/:id/leads/:email` | DELETE | Remove lead from campaign |
| `/api/campaigns/:id/leads/:email/unsubscribe` | POST | Mark lead as unsubscribed |

### Activities (send/open/reply/bounce)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/activities` | GET | Fetch activities with filters |

## Add leads to campaign

**Endpoint:** `POST /api/campaigns/:campaignId/leads`

**Body (array of leads):**
```json
[
  {
    "email": "prospect@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "Acme Inc",
    "customFields": {
      "funding_line": "Saw you raised $52M in the Series B.",
      "new_in_role_line": "you joined Acme as VP of Operations back in March"
    }
  }
]
```

**Key fields:**
- `email` (required)
- `firstName`, `lastName` (recommended)
- `companyName`, `phone`, `linkedinUrl` (optional)
- `customFields` — object with any custom variables for email template

**Rate limit:** 100 leads per request, 120 req/min

**Dedupe:** Lemlist auto-dedupes by email within a campaign. Same email added twice = one lead.

## Fetch activities (replies, opens, bounces)

**Endpoint:** `GET /api/activities`

**Query params:**
```
?type=replied           # Filter by activity type
&campaignId=abc123      # Filter by campaign
&limit=100              # Results per page (default 100, max 100)
&offset=0               # Pagination offset
```

**Activity types:**
- `emailsOpened` — opens
- `emailsClicked` — link clicks
- `emailsBounced` — bounces (hard + soft)
- `emailsSent` — sent
- `replied` — replies (all)
- `interested` — marked as interested
- `notInterested` — marked as not interested
- `unsubscribed` — unsubscribed

**Response:**
```json
[
  {
    "type": "replied",
    "campaignId": "abc123",
    "email": "prospect@company.com",
    "emailId": "email_xyz",
    "createdAt": "2026-09-23T21:00:00Z",
    "replyMessage": "Sounds interesting, let's chat..."
  }
]
```

## Rate limits

- **120 requests per minute**
- **100 leads per POST request**
- **100 activities per GET request** (paginate with `offset`)

**Compared to Smartlead:**
- Smartlead: 60 req/min → Lemlist: 120 req/min (2x faster)

## Error handling

### 401 Unauthorized

- Missing or invalid `LEMLIST_API_KEY`
- Auth format wrong (must be `https://:KEY@...`)

### 429 Too Many Requests

Rate limit exceeded. Wait 60 seconds or implement exponential backoff.

### 400 Bad Request

Invalid payload. Common causes:
- Missing required `email` field
- Invalid email format
- `customFields` not an object

### 404 Not Found

Campaign ID or lead email doesn't exist.

## Lemlist vs Smartlead API mapping

| Feature | Smartlead | Lemlist |
|---|---|---|
| Auth | `X-API-Key` header | `:KEY@` in URL |
| Campaign ID type | UUID | String ID |
| Add leads | `POST /campaigns/{id}/leads` | `POST /api/campaigns/:id/leads` |
| Lead dedupe | Manual (check before upload) | Auto (by email per campaign) |
| Reply fetching | `GET /campaigns/{id}/replies` | `GET /api/activities?type=replied` |
| Unsubscribe | `POST /leads/{id}/unsubscribe` | `POST /api/campaigns/:id/leads/:email/unsubscribe` |
| Rate limit | 60 req/min | 120 req/min |

## Campaign creation

**Endpoint:** `POST /api/campaigns`

**Body:**
```json
{
  "name": "Campaign Name",
  "emailTemplate": {
    "subject": "{{companyName}} + Acme: GTM partnership",
    "body": "Hi {{firstName}},\n\n{{funding_line}}\n\nWanted to reach out about...",
    "fromName": "Jane Smith",
    "fromEmail": "jane@acme.com"
  },
  "schedule": {
    "timezone": "America/New_York",
    "sendingDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "sendingHours": {
      "start": "09:00",
      "end": "17:00"
    }
  }
}
```

**Variable syntax:** `{{variableName}}` (double curly braces)

**Spintax:** `{option1|option2|option3}` (single curly braces with pipes)

## Unsubscribe handling

Lemlist auto-appends unsubscribe link to every email (required by law).

**To fetch unsubscribes:**
```bash
curl "https://:${LEMLIST_API_KEY}@api.lemlist.com/api/activities?type=unsubscribed"
```

**To manually unsubscribe a lead:**
```bash
curl -X POST "https://:${LEMLIST_API_KEY}@api.lemlist.com/api/campaigns/:campaignId/leads/:email/unsubscribe"
```

## Environment variables

```bash
LEMLIST_API_KEY=your_lemlist_api_key
```

## Full API docs

https://developer.lemlist.com/

## Next steps

- Inbox management: `/lemlist-inbox-manager`
- Campaign upload: `/lemlist-campaign-upload`
- Reply scoring: `/reply-scoring` (adapted for Lemlist)
- Weekly ops: `/weekly-rhythm`

## References

- Original skill: `skills/smartlead-api/SKILL.md`
- Lemlist → Smartlead migration: `deepline/docs/lemlist-migration.md`
