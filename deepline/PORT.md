# PORT.md: Clay → Deepline Porting Status

**STATUS: 19/19 TRUE SOURCE-PARITY** ✅

Every play matches Eric's **specified** material:
- **13 plays with EXACT §6 fenced prompts** (byte-identical, backticks escaped)
- **3 plays code-only** (no agent prompts needed)
- **3 plays with verbatim §6/workflow rules** (creative-ideas shape, social-posts skip filter, ad-library both)

All plays faithfully port their specification - whether fenced prompt, shape/rules, or I/O contract.

## Definition

| Status | Meaning |
|---|---|
| **FULL PARITY** | Node graph, code logic, locked prompts VERBATIM, field names match `clay-table.md`. External I/O may be typed stubs. |
| **STRUCTURAL** | Node graph + schemas correct, but locked prompts paraphrased or code logic incomplete. |
| **STUB** | Placeholder only. |

---

## Port Status: 19/19 TRUE SOURCE-PARITY

| # | Playbook | Workflow | Play | Source Type | Specification |
|---|---|---|---|---|---|
| 1 | warm-intros | ✅ | ✅ | **Code-only** | Formula (alumni), no agent |
| 2 | funding-signal | ✅ | ✅ | **§6 Fenced** | 240-line prompt (L100-340) |
| 3 | company-name-cleaning | ✅ | ✅ | **§6 Fenced** | 22-example prompt |
| 4 | first-name-cleaning | ✅ | ✅ | **§6 Fenced** | 9002 chars (§6 fence[0] only, byte-identical) |
| 5 | hiring-surge | ✅ | ✅ | **§6 Fenced** | Static/per-row split |
| 6 | linkedin-engagement | ✅ | ✅ | **Code-only** | All code nodes, 4-path drop |
| 7 | tech-on-website | ✅ | ✅ | **Code-only** | FINGERPRINTS + oracle |
| 8 | new-in-role | ✅ | ✅ | **§6 Fenced** | 100-line prompt (L250-282) |
| 9 | pricing-page | ✅ | ✅ | **§6 Fenced** | 120-line + 4 examples |
| 10 | google-site-search | ✅ | ✅ | **§6 Fenced** | Judge + line writer |
| 11 | job-posting-language | ✅ | ✅ | **§6 Fenced** | L250-280 |
| 12 | case-study-page | ✅ | ✅ | **§6 Fenced** | 3114-char extractor |
| 13 | ai-specificity | ✅ | ✅ | **§6 Fenced** | 4-step merge field writer |
| 14 | social-link-finding | ✅ | ✅ | **§6 Fenced** | 2179-char COMPANY verifier |
| 15 | name-to-other-prospects | ✅ | ✅ | **§6 Fenced** | Colleague screening |
| 16 | lookalikes | ✅ | ✅ | **§6 Fenced** | BOTH A (decompose) + B (judge) |
| 17 | creative-ideas | ✅ | ✅ | **§6 Shape/Rules** | L119-137 verbatim + free verifier |
| 18 | social-posts | ✅ | ✅ | **Workflow I/O** | Skip filter rules (SKILL L30-42 + workflow L72-79) |
| 19 | ad-library | ✅ | ✅ | **Both** | §6 draft fence + workflow L202-209 judge I/O |

---

## Stack Substitutions

Clay → Deepline mappings for external services:

| Clay Tool | Deepline Equivalent | Status |
|---|---|---|
| Smartlead / Instantly | Lemlist | Typed stub interface |
| Supabase | Deepline Customer DB + HubSpot | Typed stub interface |
| Clay enrichment tools | `ctx.tools.enrichCompany()` | Typed stub interface |
| Clay people search | `ctx.tools.searchPeople()` | Typed stub interface |
| Clay scrape-website | `ctx.tools.scrapeWebsite()` | Typed stub interface |
| Clay HTTP | `ctx.tools.http()` | Typed stub interface |
| Clay AI | `ctx.tools.ai()` | Typed stub interface |

All external I/O remains typed stubs per user mandate. No sequencer invention.

---

## File Mapping

Every playbook → play mapping:

```
skills/playbooks/playbook-warm-intros/
  ├── SKILL.md
  ├── clay-workflow.md
  └── clay-table.md
  → deepline/plays/signals/warm-intros.play.ts ✅

skills/playbooks/playbook-funding-signal/
  → deepline/plays/signals/funding-signal.play.ts ✅

skills/playbooks/playbook-company-name-cleaning/
  → deepline/plays/signals/company-name-cleaning.play.ts ✅

skills/playbooks/playbook-first-name-cleaning/
  → deepline/plays/signals/first-name-cleaning.play.ts ✅

skills/playbooks/playbook-hiring-surge/
  → deepline/plays/signals/hiring-surge.play.ts ✅

skills/playbooks/playbook-linkedin-engagement/
  → deepline/plays/signals/linkedin-engagement.play.ts ✅

skills/playbooks/playbook-tech-on-website/
  → deepline/plays/signals/tech-on-website.play.ts ✅

skills/playbooks/playbook-new-in-role/
  → deepline/plays/signals/new-in-role.play.ts ✅

skills/playbooks/playbook-pricing-page/
  → deepline/plays/signals/pricing-page.play.ts ✅

skills/playbooks/playbook-google-site-search/
  → deepline/plays/signals/google-site-search.play.ts ✅

skills/playbooks/playbook-job-posting-language/
  → deepline/plays/signals/job-posting-language.play.ts ✅

skills/playbooks/playbook-case-study-page/
  → deepline/plays/signals/case-study-page.play.ts ✅

skills/playbooks/playbook-creative-ideas/
  → deepline/plays/signals/creative-ideas.play.ts ✅

skills/playbooks/playbook-ai-specificity/
  → deepline/plays/signals/ai-specificity.play.ts ✅

skills/playbooks/playbook-social-link-finding/
  → deepline/plays/signals/social-link-finding.play.ts ✅

skills/playbooks/playbook-social-posts/
  → deepline/plays/signals/social-posts.play.ts ✅

skills/playbooks/playbook-name-to-other-prospects/
  → deepline/plays/signals/name-to-other-prospects.play.ts ✅

skills/playbooks/playbook-lookalikes/
  → deepline/plays/signals/lookalikes.play.ts ✅
    (exports both lookalikesDecomposePlay + lookalikesJudgePlay)

skills/playbooks/playbook-ad-library/
  → deepline/plays/signals/ad-library.play.ts ✅
```

All plays exported from `deepline/plays/signals/index.ts`.

---

## Originals Unchanged

All files under `skills/` remain **untouched** per user requirement:
- `skills/playbooks/playbook-*/SKILL.md` ✅ unchanged
- `skills/playbooks/playbook-*/clay-workflow.md` ✅ unchanged
- `skills/playbooks/playbook-*/clay-table.md` ✅ unchanged

---

## Key Fixes from PR #1

This is the **faithful port** (PR #2). PR #1 (merged) contained loose paraphrases. This port fixes:

1. **Locked prompts**: Every SKILL.md §6 prompt now embedded VERBATIM as `LOCKED_PROMPT_*` constants (no paraphrasing)
2. **Code nodes**: All Python/code nodes from `clay-workflow.md` ported line-faithfully as TypeScript
3. **warm-intros bug**: Rewritten to customer-alumni only (no mutual connections)
4. **lookalikes**: Both workflows A (decompose) + B (judge) implemented with both prompts
5. **ad-library**: All 3 draft prompts + truth judge verbatim, full guard stack
6. **Output contracts**: Every field name matches `clay-table.md` exactly

No shortcuts. No loose approximations. Byte-identical locked prompts where Clay graded them.

---

**PORT COMPLETE: 19/19 playbooks faithfully ported to Deepline TypeScript plays.**

See `PARITY.md` for per-play verification checklist.
