# Deepline Port of coldoutboundskills

Deepline-native implementations of Growth Engine X's cold email infrastructure, lead sourcing, and signal playbooks.

**Original repo (Clay/Claude):** https://github.com/growthenginenowoslawski/coldoutboundskills  
**This port:** All 19 signal playbooks + 30 operational skills adapted for Deepline + Lemlist

---

## Quick Start

### 1. Prerequisites

- **Deepline CLI** installed: https://docs.deepline.ai/cli/installation
- **Node.js 18+** for TypeScript plays
- **Lemlist account** (replaces Smartlead/Instantly) — https://lemlist.com
- **HubSpot** (optional) — CRM integration for customer tracking

### 2. Install Dependencies

```bash
cd deepline/
npm install   # If you see package.json; otherwise skip
```

### 3. Configure Environment

```bash
cp .env.example .env.deepline
# Edit .env.deepline with your API keys
```

Required env vars:
```bash
# Deepline
DEEPLINE_API_KEY=your_deepline_key

# Sending platform
LEMLIST_API_KEY=your_lemlist_key

# Optional: List building (bring your own keys)
PROSPEO_API_KEY=your_prospeo_key       # For person/company search
BLITZ_API_KEY=your_blitz_key           # For domain-to-contacts
RAPIDAPI_KEY=your_rapidapi_key         # For Google Maps, LinkedIn data

# Optional: CRM/enrichment
HUBSPOT_API_KEY=your_hubspot_key
OPENROUTER_API_KEY=your_openrouter_key # For AI enrichment
```

Add `.env.deepline` to `.gitignore`:
```bash
echo ".env.deepline" >> ../.gitignore
echo "output/" >> ../.gitignore
```

### 4. Verify Setup

```bash
deepline auth whoami
deepline tools list | head -20
```

---

## What's In Here

### 📊 Signal Plays (`plays/signals/`)

19 TypeScript plays — each turns **one buying signal** into **one copy-ready sentence**.

| Play | Output Field | Use When |
|---|---|---|
| `funding-signal.play.ts` | `funding_line` | Company raised a round recently |
| `new-in-role.play.ts` | `new_in_role_line` | Person started/changed job titles |
| `linkedin-engagement.play.ts` | `engagement_line` | Engaged with competitor/customer posts |
| `hiring-surge.play.ts` | `hiring_line` | Company is hiring aggressively |
| `job-posting-language.play.ts` | `job_posting_insight` | Job descriptions reveal GTM shifts |
| `social-posts.play.ts` | `social_post_line` | Recent LinkedIn posts from target |
| `warm-intros.play.ts` | `mutual_connection` | Mutual connections for warm intro |
| `ad-library.play.ts` | `ad_library_line` | Meta/Facebook ad campaigns |
| `pricing-page.play.ts` | `pricing_insight` | Pricing page structure analysis |
| `case-study-page.play.ts` | `case_study_line` | Case studies on their website |
| `tech-on-website.play.ts` | `tech_stack_line` | Tech stack detection (BuiltWith-style) |
| `google-site-search.play.ts` | `site_search_result` | `site:domain.com` Google search |
| ... | ... | (19 plays total) |

**How to run one:**
```bash
cd plays/signals/
deepline plays check funding-signal.play.ts                    # Compile only, no spend
deepline plays run --file funding-signal.play.ts --input '{"csv":"leads.csv"}' --watch
deepline runs export <run-id> --out output_funding.csv
```

### 🛠️ Operational Skills (`skills/`)

Adapted for Deepline + Lemlist stack:

**Track 1 — Strategy**
- `kickoff/` — Single orchestrator (ICP → lead magnet → strategy → plan)
- `icp-onboarding/` — Conversational intake → `client-profile.yaml`
- `campaign-strategy/` — 15-25 campaign ideas with Deepline context
- `campaign-copywriting/` — Step-by-step copy writer

**Track 2 — Infrastructure**
- `domain-setup/` — Dynadot + Zapmail (unchanged) + Lemlist inbox notes
- `lemlist-inbox-manager/` — Warmup, signatures, tags (replaces `smartlead-inbox-manager`)
- `deliverability-audit/` — SPF/DKIM/DMARC + Lemlist placement tests
- `incident-response/` — Triage playbook (spam, bounces, blacklists)

**Track 3 — List Building**
- `list-builder/` — Meta skill for Deepline-native list sourcing
- `list-expander/` — Seed → lookalike → qualification → contacts
- `prospeo-export/`, `blitz-list-builder/`, `google-maps/` — List sources
- `icp-prompt-builder/` — Qualification prompt generator
- `list-quality-scorecard/` — Grade CSV before send

**Track 4 — Copy & Send**
- `starter-kit/` — 14-step tutorial (Deepline + Lemlist)
- `spam-word-checker/` — Scan copy for deliverability killers
- `lemlist-api/` — API reference (replaces `smartlead-api`)
- `lemlist-campaign-upload/` — Upload leads.csv to Lemlist

**Track 5 — Iterate**
- `reply-scoring/` — Positive reply rate (Lemlist API)
- `experiment-design/` — Single-variable framework
- `auto-research/` — Autonomous campaign launcher (Deepline → Lemlist)
- `weekly-rhythm/` — Mon/Wed/Fri ops playbook

---

## Recommended Path

### If You've Never Run Cold Email

1. **`/kickoff` skill** — Orchestrated flow: ICP → lead magnet → strategy → plan
2. **Domain setup** → `skills/domain-setup/` (Dynadot + Zapmail + Lemlist)
3. **One signal play** → Run `funding-signal.play.ts` or `new-in-role.play.ts` as pilot
4. **First campaign** → `skills/lemlist-campaign-upload/`
5. **Wait 21 days** → Then `/reply-scoring` skill
6. **Weekly rhythm** → `skills/weekly-rhythm/` (Mon/Wed/Fri ops)

### If You Have Experience

1. **ICP lock-down** → `skills/icp-onboarding/`
2. **Audit existing infra** → `skills/deliverability-audit/`
3. **Migrate to Lemlist** → `docs/lemlist-migration.md` (if coming from Smartlead/Instantly)
4. **Run signal plays** → Pick 2-3 signals, pilot on 50 rows each
5. **Automate** → `skills/auto-research/` for daily launches

### If You're Debugging a Broken Campaign

1. **Deliverability audit** → `skills/deliverability-audit/`
2. **Reply sentiment** → `skills/reply-scoring/`
3. **Spam word scan** → `skills/spam-word-checker/`
4. **Inbox comparison** → `skills/deliverability-test/`

---

## Clay → Deepline Action Mapping

See `PORT.md` for complete mapping. Key substitutions:

| Clay Action | Deepline Equivalent | Cost |
|---|---|---|
| Find People (title + location) | `prospeo_search_person` | FREE to CHEAP |
| Find Email (waterfall) | `name-and-domain-to-email-waterfall` play | ~1–3 credits/row |
| Enrich Company | `prospeo_enrich_company` or `crustdata_companydb_search` | ~1 credit |
| Claygent (web research) | `exa_search` + `deeplineagent` | ~$0.50–2/1k |
| Use AI (no web) | `deeplineagent` with `jsonSchema` | ~$0.10–0.50/1k |
| Validate Email | `leadmagic_email_validation` | ~0.1 credits |
| LinkedIn engagement | `harvestapi_get_post_reactions` + `harvestapi_get_post_comments` | ~$4–5/1k |

**Full action catalog:**
```bash
deepline tools list
deepline tools search "<what you need>"
deepline tools describe <tool_id>
```

---

## Cost Expectations

**First campaign (2,000 leads, 20 domains, 40 inboxes):**
- Domains: ~$240 one-time (20 × $12 .com)
- Zapmail: ~$60/mo (40 inboxes)
- Lemlist: ~$59/mo starter plan
- Prospeo: ~$20 for 2,000-lead export
- Deepline credits: ~$10–30 (depends on enrichment depth)
- **Month 1 total: ~$390. Recurring: ~$150/mo**

Slightly higher than Clay/Smartlead stack due to Lemlist tier, but comparable for credits.

---

## Stack Comparison

| Component | Original (Clay/Claude) | This Port (Deepline) |
|---|---|---|
| **Build interface** | Clay browser UI | Deepline CLI + TypeScript plays |
| **Sending platform** | Smartlead or Instantly | **Lemlist** |
| **CRM truth** | Supabase touch ledgers | **Deepline Customer DB + HubSpot** |
| **Email validation** | MillionVerifier/ZeroBounce | Deepline native (`leadmagic_email_validation`) |
| **AI generation** | Clay `use-ai` / `claygent` | `deeplineagent` |
| **Web research** | Clay `claygent` | `exa_search` + `deeplineagent` |
| **List sources** | Clay "Find People" | `prospeo_search_person` / `leadmagic_profile_search` |
| **Version control** | Clay table exports (JSON) | **Git-native TypeScript plays** |

---

## Play Structure

Every signal play follows this pattern:

```typescript
import { definePlay } from 'deepline';

export default definePlay(
  'signal-name',
  async (ctx, input: { csv: string }) => {
    // Load CSV
    const rows = await ctx.csv(input.csv).run();

    // Apply signal logic
    const enriched = await rows
      .withColumn('signal_field', async (row) => {
        // Guard logic (code)
        if (!row.domain) return '';

        // Deepline tool call
        const result = await ctx.tools.execute({
          id: 'signal_check',
          tool: 'deepline_tool_name',
          input: { domain: row.domain },
          description: 'Check signal for this domain',
        });

        // AI generation (if needed)
        const line = await ctx.tools.execute({
          id: 'generate_line',
          tool: 'deeplineagent',
          input: {
            prompt: `Write a short clause about ${result.data}...`,
            jsonSchema: { type: 'object', properties: { line: { type: 'string' } } },
          },
          description: 'Generate copy-ready line',
        });

        return line.data.line || '';  // Abstain = empty string
      })
      .run({ key: (row) => row.email });

    return { rows: enriched };
  },
  {
    description: 'Turn [signal] into copy-ready sentence',
    billing: { maxCreditsPerRun: 100 },
  }
);
```

**Key contracts:**
- Input: `{ csv: string }` pointing to seed CSV path
- Output: `{ rows: <dataset> }` with new `signal_field` column
- Abstain = `""` (empty string), never `"N/A"` or `null`
- Guard logic in code, wording in AI
- No em dashes in generated copy

---

## Testing & Validation

### Compile Check (no spend)
```bash
deepline plays check <play-name>.play.ts
```

### Pilot Run (3 rows)
```bash
head -4 leads.csv > pilot.csv   # header + 3 rows
deepline plays run --file <play-name>.play.ts --input '{"csv":"pilot.csv"}' --watch
```

### Full Run
```bash
deepline plays run --file <play-name>.play.ts --input '{"csv":"leads.csv"}' --watch
deepline runs export <run-id> --out output.csv
```

### Parity Validation (vs Clay)
```bash
# Export same inputs through Clay, compare outputs
python3 ../skills/playbooks/clay-playbooks/compare.py clay_output.csv deepline_output.csv
```

Expected thresholds:
- **Deterministic fields** (formulas, guards): 100% match
- **LLM classification**: ≥90% match
- **LLM generation**: Tone and intent match (manual review)

---

## Lemlist Migration Guide

See `docs/lemlist-migration.md` for full Smartlead → Lemlist substitution.

**Quick reference:**

| Smartlead Feature | Lemlist Equivalent |
|---|---|
| Campaign creation | Lemlist Campaigns API |
| Lead upload | `POST /api/campaigns/:id/leads` |
| Warmup settings | Lemlist Warmup settings UI + API |
| Inbox signatures | Lemlist Sender settings |
| Reply fetching | `GET /api/activities` with `type=replied` |
| Unsubscribe handling | Lemlist native unsubscribe tracking |
| Spintax | Lemlist supports `{option1|option2}` syntax |

**API differences:**
- Smartlead uses `email` field; Lemlist uses `email` + `firstName`, `lastName` (optional)
- Smartlead campaign IDs are UUIDs; Lemlist uses integer IDs
- Lemlist rate limits: 120 req/min (vs Smartlead 60 req/min)

---

## File Structure

```
deepline/
├── README.md                     # This file
├── PORT.md                       # Complete mapping inventory
│
├── plays/
│   └── signals/                  # 19 signal playbooks (.play.ts)
│       ├── funding-signal.play.ts
│       ├── new-in-role.play.ts
│       └── ...
│
├── skills/                       # Operational skills (SKILL.md + scripts)
│   ├── kickoff/
│   ├── icp-onboarding/
│   ├── list-builder/
│   ├── lemlist-inbox-manager/
│   └── ...
│
├── docs/
│   ├── clay-to-deepline.md       # Action mapping reference
│   └── lemlist-migration.md      # Smartlead → Lemlist guide
│
├── .env.example                  # Template env vars
└── output/                       # gitignored: play run outputs
```

---

## FAQ

### Q: Can I use Smartlead/Instantly instead of Lemlist?

**A:** Yes, but you'll need to adapt `skills/lemlist-*` skills to use Smartlead/Instantly APIs. The signal plays are platform-agnostic (they output enriched CSVs). See original `skills/smartlead-api/` and `skills/cold-email-starter-kit/references/09-instantly-api.md` for API docs.

### Q: Do I need to delete the Clay skills?

**A:** No! Originals are preserved in `skills/`. Deepline ports live in `deepline/`. Keep both for reference.

### Q: What if a Deepline tool doesn't exist for a Clay action?

**A:** Three options:
1. Use BYO API keys (Prospeo, Blitz, RapidAPI) — same as Clay
2. Use `generic_http_request` Deepline tool
3. Implement in Python/TypeScript script, output CSV, import into play

### Q: Are the Clay recipes (`clay-table.md`, `clay-workflow.md`) tested?

**A:** Per original SKILL.md verification lines: the locked prompts were graded end-to-end, but the Clay table/workflow recipes are **specifications, never built**. Deepline plays ARE tested (or marked as stubs in `PORT.md`).

### Q: Can I run plays in parallel?

**A:** Yes. Each play run is independent. Use `deepline plays run` with different `--input` for separate runs:
```bash
deepline plays run --file funding-signal.play.ts --input '{"csv":"batch1.csv"}' &
deepline plays run --file new-in-role.play.ts --input '{"csv":"batch2.csv"}' &
```

### Q: How do I update locked prompts?

**A:** Don't, unless you re-grade. Locked prompts are byte-identical to verified versions. If you change one:
1. Document the change reason in `SKILL.md`
2. Re-test on ≥10 rows
3. Update verification section with new results
4. Commit with clear message: `fix(new-in-role): update prompt for cross-year guard`

---

## Support

- **Original skills:** Eric Nowoslawski (Growth Engine X) — https://growthengine-x.com
- **Deepline port questions:** Open GitHub issue with `[deepline]` prefix
- **Deepline product:** https://docs.deepline.ai
- **Lemlist support:** https://help.lemlist.com

---

## License

MIT — same as original. Use it, fork it, profit from it. Attribution appreciated but not required.

**Forked from:** https://github.com/growthenginenowoslawski/coldoutboundskills  
**Original author:** Eric Nowoslawski / Growth Engine X  
**Deepline port:** Jai Toor / Deepline GTM  
**Port date:** 2026-09-23
