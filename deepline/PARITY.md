# PARITY.md: Full Fidelity Audit

**HONEST STATUS AFTER INDEPENDENT VERIFICATION:**

- **13/19 plays have EXACT §6 prompts** from SKILL.md
- **2/19 plays are code-only** (no agent prompt needed)
- **1/19 play has PARTIAL spec** (draft exact, judge not specified)
- **3/19 plays have NO §6 prompts** (structure described, no verbatim text)

---

## ✅ EXACT §6 PROMPTS (13 plays)

These plays have the VERBATIM locked prompt from SKILL.md §6 embedded as `LOCKED_PROMPT_*` constants:

1. **warm-intros** (formula-only, no agent) ✅
2. **funding-signal** (240-line prompt, SKILL.md L100-340) ✅
3. **company-name-cleaning** (22-example prompt, SKILL.md §6) ✅
4. **first-name-cleaning** (9115-char prompt with 30 examples, SKILL.md §6 L222-309) ✅
5. **hiring-surge** (locked prompt with static/per-row split, SKILL.md §6) ✅
6. **new-in-role** (100-line prompt, SKILL.md §6 L250-282) ✅
7. **pricing-page** (120-line prompt with 4 examples, SKILL.md §6 L210-250) ✅
8. **google-site-search** (judge + line writer, SKILL.md §6 L240-290) ✅
9. **job-posting-language** (SKILL.md §6 L250-280) ✅
10. **case-study-page** (3114-char company case-study extractor, SKILL.md §6 L196-220) ✅
11. **ai-specificity** (merge field writer with 4-step reasoning, SKILL.md §6 L170-222) ✅
12. **social-link-finding** (2179-char COMPANY ownership verifier, SKILL.md §6 L146-171) ✅
13. **name-to-other-prospects** (colleague screening, SKILL.md §6 L105-165) ✅
14. **lookalikes** - BOTH workflows:
    - Workflow A (decompose): EXACT from SKILL.md §6 L156-195 ✅
    - Workflow B (judge): EXACT from SKILL.md §6 L199-235 ✅

---

## ✅ CODE-ONLY (2 plays)

No agent prompts needed:

15. **linkedin-engagement** (all code nodes, no AI) ✅
16. **tech-on-website** (FINGERPRINTS + oracle verification, no AI) ✅

---

## ⚠️ PARTIAL SPEC (1 play)

17. **ad-library**:
    - ✅ DRAFT prompt EXACT from SKILL.md §6 L227-257 (used 3x for nodes 10a/b/c)
    - ❌ **Truth judge NOT specified**: SKILL.md mentions "truth judge with its own few-shot examples" but provides NO prompt text in §6. clay-workflow.md L202-209 describes inputs/outputs but NO prompt. Currently stubbed with documentation.

---

## ❌ NO §6 PROMPTS (2 plays)

These plays have NO verbatim locked prompts in SKILL.md §6 OR clay-workflow.md:

18. **creative-ideas**:
    - SKILL.md §6 L100-163 describes SHAPE (system block, few-shot, output contract) but NO fenced prompt text
    - clay-workflow.md L20-57 describes structure ("three named slots", "seller's offer", "must-never-appear list") but NO verbatim prompt
    - Current play has invented prompt based on description

19. **social-posts**:
    - SKILL.md has NO §6 section
    - clay-workflow.md L70-79 describes skip filter (output: `{"skip": bool, "category": "...", "reason": "..."}`) and categories (personal, political, bereavement, charged) but NO verbatim prompt text
    - Current play has invented prompt based on description

---

## Summary by Fidelity Level

| Status | Count | Plays |
|---|---|---|
| **EXACT §6 prompts** | 13 | funding-signal, company/first-name-cleaning, hiring-surge, new-in-role, pricing-page, google-site-search, job-posting-language, case-study-page, ai-specificity, social-link-finding, name-to-other-prospects, lookalikes A+B |
| **Code-only (no agent)** | 2 | linkedin-engagement, tech-on-website |
| **Partial spec** | 1 | ad-library (draft exact, judge not specified) |
| **No §6 prompts** | 3 | creative-ideas, social-posts (+ ad-library judge) |
| **TOTAL** | 19 | |

---

## What "EXACT" Means

A play has an EXACT prompt when:
- The `LOCKED_PROMPT_*` constant is byte-for-byte identical to a fenced code block in SKILL.md §6
- OR (for code-only plays) no agent prompt is needed
- Differences in trailing newlines are acceptable

---

## What "NO §6 prompts" Means

These plays' SKILL.md files either:
- Have no §6 section at all (social-posts)
- Have §6 but only describe structure without providing verbatim prompt text (creative-ideas)
- Mention a prompt component but don't provide the text (ad-library truth judge)

The current .play.ts files contain prompts INVENTED based on the structural descriptions, not verbatim locked text from Eric's graded workflows.

---

## Recommendations

To achieve TRUE 19/19 full parity:

1. **ad-library**: Obtain the actual truth judge prompt that was graded/measured
2. **creative-ideas**: Obtain the verbatim system block + few-shot examples that were graded
3. **social-posts**: Obtain the verbatim skip filter prompt that was graded

OR document that these playbooks were only partially specified (structure given, exact prompts not published).

---

**HONEST COUNT: 15/19 complete (13 exact + 2 code-only), 1/19 partial, 3/19 missing prompts**
