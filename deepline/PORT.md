# coldoutboundskills → Deepline Port

Complete mapping of Growth Engine X's coldoutboundskills fork (Eric Nowoslawski) to Deepline-native implementations for Jai Toor / Deepline GTM.

**Fork source:** https://github.com/growthenginenowoslawski/coldoutboundskills  
**This port:** https://github.com/jptoor/coldoutboundskills

## Porting Philosophy

**Preserve originals.** All Clay/Claude skills remain in `skills/`. Deepline ports live in `deepline/`.

**Action mapping mindset.** Each Clay column/node becomes one `.withColumn(...)` (or equivalent play step). Code handles guards/logic; models only write prose; abstain = empty string; no em dashes in generated copy.

**Stack substitutions:**
- Smartlead/Instantly → **Lemlist** (+ HubSpot as CRM truth)
- Clay table/CLI → **Deepline plays** (`definePlay` + `withColumn` patterns)
- Supabase touch ledgers → **Deepline Customer DB / HubSpot notes**
- ZeroBounce/MillionVerifier validation → Deepline native validation where available
- Prospeo/Blitz → kept as BYO keys when Deepline has no native equivalent

---

## Track 6: Signal Playbooks (19 total)

All 19 playbooks ported as TypeScript Deepline plays under `deepline/plays/signals/`. Each preserves:
- Output field name (e.g. `funding_line`)
- Source/guard logic from SKILL.md + clay-workflow.md
- Abstain = empty string
- Locked prompts and smoke-test domains from docs

| # | Original Playbook | Output Field | Deepline Play | Status | Notes |
|---|---|---|---|---|---|
| 1 | `playbook-fundraising` | `funding_line` | `funding-signal.play.ts` | ✅ PORTED | Uses Deepline funding-updates radar |
| 2 | `playbook-new-in-role` | `new_in_role_line` | `new-in-role.play.ts` | ✅ PORTED | Person time-in-role filter + deeplineagent |
| 3 | `playbook-linkedin-engagement` | `engagement_line` | `linkedin-engagement.play.ts` | ✅ PORTED | HarvestAPI post reactions + comments |
| 4 | `playbook-social-posts` | `social_post_line` | `social-posts.play.ts` | ✅ PORTED | Recent LinkedIn posts via HarvestAPI |
| 5 | `playbook-warm-intros` | `mutual_connection` | `warm-intros.play.ts` | ✅ PORTED | Mutual connections via person enrichment |
| 6 | `playbook-hiring-surge` | `hiring_line` | `hiring-surge.play.ts` | ✅ PORTED | Job postings + headcount growth signal |
| 7 | `playbook-job-posting-language` | `job_posting_insight` | `job-posting-language.play.ts` | ✅ PORTED | Parse job descriptions for GTM signals |
| 8 | `playbook-ad-library` | `ad_library_line` | `ad-library.play.ts` | ✅ PORTED | Facebook/Meta Ad Library API |
| 9 | `playbook-pricing-page` | `pricing_insight` | `pricing-page.play.ts` | ✅ PORTED | Scrape + analyze pricing page structure |
| 10 | `playbook-case-study-page` | `case_study_line` | `case-study-page.play.ts` | ✅ PORTED | Find + extract case studies from website |
| 11 | `playbook-tech-on-website` | `tech_stack_line` | `tech-on-website.play.ts` | ✅ PORTED | BuiltWith-style tech detection |
| 12 | `playbook-google-site-search` | `site_search_result` | `google-site-search.play.ts` | ✅ PORTED | `site:domain.com` Google search operator |
| 13 | `playbook-company-name-cleaning` | `clean_company_name` | `company-name-cleaning.play.ts` | ✅ PORTED | Deterministic regex + model cleanup |
| 14 | `playbook-first-name-cleaning` | `clean_first_name` | `first-name-cleaning.play.ts` | ✅ PORTED | Strip middle names, initials, nicknames |
| 15 | `playbook-social-link-finding` | `linkedin_url` | `social-link-finding.play.ts` | ✅ PORTED | Resolve LinkedIn profile from name+company |
| 16 | `playbook-lookalikes` | `lookalike_companies` | `lookalikes.play.ts` | ✅ PORTED | Exa/CrustData similar company discovery |
| 17 | `playbook-name-to-other-prospects` | `other_prospects` | `name-to-other-prospects.play.ts` | ✅ PORTED | Find coworkers at same domain |
| 18 | `playbook-ai-specificity` | `specific_line` | `ai-specificity.play.ts` | ✅ PORTED | Generic → specific copy transformation |
| 19 | `playbook-creative-ideas` | `creative_angles` | `creative-ideas.play.ts` | ✅ PORTED | Multi-angle campaign brainstorming |

---

## Track 1: Strategy Skills (5 total)

| Original Skill | Deepline Path | Status | Notes |
|---|---|---|---|
| `cold-email-kickoff` | `deepline/skills/kickoff/` | ✅ PORTED | Orchestrator adapted for Deepline plays |
| `icp-onboarding` | `deepline/skills/icp-onboarding/` | ✅ PORTED | Produces `client-profile.yaml` for Deepline context |
| `lead-magnet-brainstorm` | `deepline/skills/lead-magnet/` | ✅ PORTED | No tool changes needed (pure LLM) |
| `campaign-strategy` | `deepline/skills/campaign-strategy/` | ✅ PORTED | Generates campaign ideas for Deepline execution |
| `campaign-copywriting` | `deepline/skills/campaign-copywriting/` | ✅ PORTED | Step-by-step copy writer adapted for Deepline YAML output |

---

## Track 2: Infrastructure Skills (4 total)

| Original Skill | Deepline Path | Status | Notes |
|---|---|---|---|
| `zapmail-domain-setup-public` | `deepline/skills/domain-setup/` | ✅ ADAPTED | Dynadot+Zapmail still valid; added Lemlist inbox provisioning notes |
| `smartlead-inbox-manager` | `deepline/skills/lemlist-inbox-manager/` | ✅ ADAPTED | Ported to Lemlist API; warmup settings + signatures |
| `email-deliverability-audit` | `deepline/skills/deliverability-audit/` | ✅ ADAPTED | SPF/DKIM/DMARC checks remain; Lemlist placement tests |
| `deliverability-incident-response` | `deepline/skills/incident-response/` | ✅ PORTED | Triage playbook (platform-agnostic) |

---

## Track 3: List Building Skills (10 total)

| Original Skill | Deepline Path | Status | Notes |
|---|---|---|---|
| `list-builder` | `deepline/skills/list-builder/` | ✅ ADAPTED | Meta skill adapted for Deepline plays; sweeps Deepline-native sources |
| `list-expander` | `deepline/skills/list-expander/` | ✅ ADAPTED | Seed → lookalike → qualification → contact discovery |
| `prospeo-full-export` | `deepline/skills/prospeo-export/` | ✅ PORTED | Prospeo script with Deepline CSV output |
| `prospeo-search-api` | `deepline/skills/prospeo-api/` | ✅ REFERENCE | API reference doc (no code changes) |
| `blitz-list-builder` | `deepline/skills/blitz-list-builder/` | ✅ PORTED | Domain-to-contacts; Blitz API calls wrapped for Deepline |
| `google-maps-list-builder` | `deepline/skills/google-maps/` | ✅ PORTED | Scrape Google Maps → Deepline CSV |
| `disco-like` | `deepline/skills/disco-like/` | ✅ ADAPTED | Lookalike discovery via CrustData/Exa native to Deepline |
| `competitor-engagers` | `deepline/plays/signals/linkedin-engagement.play.ts` | ✅ MERGED | Same as `playbook-linkedin-engagement` |
| `icp-prompt-builder` | `deepline/skills/icp-prompt-builder/` | ✅ PORTED | Qualification prompt generator (platform-agnostic) |
| `list-quality-scorecard` | `deepline/skills/list-quality-scorecard/` | ✅ PORTED | Grade CSV across 8 dimensions before send |

---

## Track 4: Copy & Send Skills (5 total)

| Original Skill | Deepline Path | Status | Notes |
|---|---|---|---|
| `cold-email-starter-kit` | `deepline/skills/starter-kit/` | ✅ ADAPTED | 14-step tutorial adapted for Deepline+Lemlist flow |
| `spam-word-checker` | `deepline/skills/spam-word-checker/` | ✅ PORTED | Scan copy for deliverability killers (platform-agnostic) |
| `smartlead-spintax` | `deepline/skills/lemlist-spintax/` | ✅ ADAPTED | Lemlist supports spintax; doc updated |
| `smartlead-api` | `deepline/skills/lemlist-api/` | ✅ ADAPTED | Lemlist API reference replaces Smartlead |
| `smartlead-campaign-upload-public` | `deepline/skills/lemlist-campaign-upload/` | ✅ ADAPTED | Upload leads.csv to Lemlist campaigns (draft mode) |

---

## Track 5: Iterate & Automate Skills (6 total)

| Original Skill | Deepline Path | Status | Notes |
|---|---|---|---|
| `positive-reply-scoring` | `deepline/skills/reply-scoring/` | ✅ ADAPTED | Lemlist API reply fetching + sentiment scoring |
| `experiment-design` | `deepline/skills/experiment-design/` | ✅ PORTED | Single-variable framework (platform-agnostic) |
| `auto-research-public` | `deepline/skills/auto-research/` | ✅ ADAPTED | Autonomous campaign: Deepline plays for list → Lemlist send |
| `personalization-subagent-pattern` | `deepline/skills/personalization-pattern/` | ✅ PORTED | Reusable pattern for per-lead Grok/Claude personalization |
| `deliverability-test-public` | `deepline/skills/deliverability-test/` | ✅ ADAPTED | Compare reply/bounce by inbox type (Lemlist-adapted) |
| `cold-email-weekly-rhythm` | `deepline/skills/weekly-rhythm/` | ✅ PORTED | Mon/Wed/Fri ops playbook for Deepline+Lemlist |

---

## Service/Platform Substitution Matrix

| Original (Clay/Claude) | Deepline Equivalent | Implementation |
|---|---|---|
| Clay "Find People" action | `prospeo_search_person` or `leadmagic_profile_search` | Deepline native tool |
| Clay "Find Email" waterfall | `name-and-domain-to-email-waterfall.play.ts` | Deepline prebuilt play |
| Clay "Enrich Company" | `prospeo_enrich_company` or `crustdata_companydb_search` | Deepline native tool |
| Clay "Claygent" (web research) | `exa_search` + `deeplineagent` (binary search optimizer) | Deepline native tool + LLM |
| Clay `use-ai` (no web) | `deeplineagent` with `jsonSchema` | Deepline native tool |
| Clay `validate-email` | `leadmagic_email_validation` or Lemlist native | Deepline native tool |
| Clay `route-row` | Filtered CSV outputs per destination | Deepline play logic |
| Clay webhook trigger | Deepline play trigger (TBD) | Future Deepline feature |
| Smartlead API | Lemlist API | Lemlist SDK/REST |
| Instantly API | Lemlist API (primary) | Lemlist SDK/REST |
| Supabase touch ledger | Deepline Customer DB + HubSpot notes | Deepline native + HubSpot integration |
| Zapmail inbox creation | Zapmail API (unchanged) | Same as original |
| Prospeo/Blitz/RapidAPI | BYO API keys | Same as original (no Deepline native equivalent) |

---

## File Layout

```
coldoutboundskills/
├── skills/                           # ORIGINALS (Eric's Clay/Claude skills - preserved)
│   ├── playbooks/                    # 19 signal playbooks (Clay table + workflow)
│   ├── cold-email-kickoff/
│   ├── icp-onboarding/
│   └── ... (30 skills total)
│
├── deepline/                         # DEEPLINE PORTS (NEW)
│   ├── PORT.md                       # This file (complete inventory)
│   ├── README.md                     # How to run Deepline ports
│   │
│   ├── plays/
│   │   └── signals/                  # 19 signal playbooks as TypeScript plays
│   │       ├── funding-signal.play.ts
│   │       ├── new-in-role.play.ts
│   │       ├── linkedin-engagement.play.ts
│   │       └── ... (19 plays total)
│   │
│   ├── skills/                       # Adapted operational skills (SKILL.md + optional scripts)
│   │   ├── kickoff/                  # Track 1 (Strategy)
│   │   ├── icp-onboarding/
│   │   ├── list-builder/             # Track 3 (List Building)
│   │   ├── lemlist-inbox-manager/    # Track 2 (Infrastructure)
│   │   ├── starter-kit/              # Track 4 (Copy & Send)
│   │   ├── reply-scoring/            # Track 5 (Iterate)
│   │   └── ...
│   │
│   ├── docs/
│   │   ├── clay-to-deepline.md       # Action mapping reference
│   │   └── lemlist-migration.md      # Smartlead→Lemlist substitution guide
│   │
│   └── .env.example                  # Deepline env vars (DEEPLINE_API_KEY, LEMLIST_API_KEY, etc.)
│
├── README.md                         # Root README (updated with Deepline port link)
├── .env.example                      # Original (Clay/Smartlead/etc.)
└── .gitignore                        # Excludes .env.deepline, output/
```

---

## Cost Comparison: Clay vs Deepline

| Operation | Clay | Deepline | Notes |
|---|---|---|---|
| Find work email (waterfall) | ~1–3 credits/row | ~1–3 credits/row | Comparable (same providers) |
| Validate email | ~0.1 credits | Native (included) | Deepline advantage |
| Person enrichment | ~1 credit | ~1 credit | Comparable |
| Company enrichment | ~1 credit | ~1 credit | Comparable |
| AI generation (`claygent`) | ~2–10 credits | `deeplineagent` ~$0.10–0.50/1k | Comparable (model-dependent) |
| Web research (multi-pass) | ~5–20 credits | Exa + deeplineagent ~$0.50–2/1k | Comparable |
| LinkedIn engagement scrape | ~$4.45/1k raw | HarvestAPI ~$4–5/1k | Comparable |

**Key Deepline advantages:**
- Native Customer DB (no Supabase setup)
- HubSpot/Lemlist integrations built-in
- CLI-first workflow (no browser required for most operations)
- TypeScript plays = version control + testing

**Key Clay advantages:**
- Browser UI for non-technical users
- Visual workflow builder
- Slightly broader action catalog (1398 actions)

---

## Testing & Validation

Each ported signal play includes:
- **Smoke test domains** from original SKILL.md (when provided)
- **Output schema validation** (field names, types, max lengths)
- **Abstain = empty string** contract enforcement
- **Guard logic** ported verbatim from Clay workflow
- **Locked prompts** preserved byte-for-byte (with model substitutions documented)

To test a ported play:
```bash
cd deepline/plays/signals
deepline plays check <play-name>.play.ts          # Compile only, no spend
deepline plays run --file <play-name>.play.ts --input '{"csv":"test.csv"}' --watch
```

---

## Migration Path for Existing Clay Users

1. **Read `deepline/README.md`** — setup, env vars, recommended kickoff
2. **Run one signal play** — pick `funding-signal.play.ts` or `new-in-role.play.ts` as pilot
3. **Compare outputs** — run same inputs through Clay + Deepline, validate parity
4. **Migrate campaigns incrementally** — one signal at a time, not all at once
5. **Update ICP/prompts** — adapt `client-profile.yaml` for Deepline context
6. **Switch send platform** — Smartlead/Instantly → Lemlist (see `docs/lemlist-migration.md`)

---

## Known Gaps & Future Work

| Feature | Status | Notes |
|---|---|---|
| Clay webhook triggers | NOT PORTED | Deepline trigger API pending |
| Clay `route-row` action | WORKAROUND | Use filtered CSV outputs per destination |
| Clay table UI harness | N/A | Deepline is CLI-first; no equivalent needed |
| Smartlead inbox warmup API | ADAPTED | Lemlist warmup settings documented |
| Supabase touch ledger scripts | REPLACED | Deepline Customer DB + HubSpot notes |
| Clay CLI read-only limitation | N/A | Deepline plays are read-write by design |

---

## Version History

- **v1.0** (2026-09-23): Initial port of all 19 signal playbooks + 30 operational skills
- Fork attribution: Eric Nowoslawski / Growth Engine X → Jai Toor / Deepline GTM

---

## Support & Contribution

- **Original skills:** Eric Nowoslawski (Growth Engine X) — https://growthengine-x.com
- **Deepline port:** Jai Toor — feedback → Cursor Cloud Agent maintenance
- **Issues:** Open GitHub issue on this fork with `[deepline]` prefix

---

**END OF PORT.MD**
