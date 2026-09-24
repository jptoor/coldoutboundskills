---
name: kickoff
description: Deepline cold email kickoff orchestrator. Single entry point: ICP → lead magnet → strategy → plan → next-skill menu. Adapted from cold-email-kickoff for Deepline + Lemlist stack.
---

# Deepline Cold Email Kickoff

**Deepline port of `cold-email-kickoff` — the guided entry point for first-time cold email campaigns.**

Single orchestrated flow: ICP → lead magnet → campaign strategy → plan → next-skill menu based on current state.

## What it does

Asks 3 questions, then produces a plan:

1. **Do you have infrastructure already?** (domains, inboxes, sending platform)
2. **Do you have a clear ICP?** (who you're targeting)
3. **Do you have a lead magnet or value prop locked?** (what you're offering)

Based on your answers, routes to the right next step:
- No infra → `/domain-setup` + `/lemlist-inbox-manager`
- No ICP → `/icp-onboarding`
- No lead magnet → `/lead-magnet-brainstorm`
- Have all 3 → `/campaign-strategy` → `/campaign-copywriting` → `/list-builder` → `/lemlist-campaign-upload`

## Outputs

- `campaign-plan.md` — recommended path + next skills to invoke
- `client-profile.yaml` — ICP definition (if run through ICP onboarding)
- `campaign-ideas.md` — 15-25 campaign angles (if run through strategy)

## When to use

**If you've never run cold email:**
1. Start here: `/kickoff`
2. Follow the menu's recommended next skill
3. Repeat until `campaign-plan.md` says "READY TO SEND"

**If you have experience:**
- Skip to `/icp-onboarding` (if ICP unclear)
- Skip to `/campaign-strategy` (if you have ICP but need angles)
- Skip to `/list-builder` (if you have ICP + angle, need leads)

## Deepline-specific adaptations

| Original (Clay/Smartlead) | Deepline Port |
|---|---|
| Clay table list building | Deepline plays (`/list-builder` → signal plays) |
| Smartlead campaign upload | Lemlist campaign upload (`/lemlist-campaign-upload`) |
| Supabase touch ledgers | Deepline Customer DB + HubSpot notes |
| Smartlead inbox warmup | Lemlist warmup (`/lemlist-inbox-manager`) |

## Cost expectations (first campaign)

**Infrastructure (Month 1):**
- Domains: ~$240 (20 × $12 .com via Dynadot)
- Zapmail: ~$60/mo (40 inboxes)
- Lemlist: ~$59/mo (starter tier)
- **Total: ~$360 Month 1, ~$120/mo recurring**

**List building + enrichment (2,000 leads):**
- Prospeo export: ~$20
- Deepline signal plays: ~$10-30 (depends on depth)
- Email validation: ~$5
- **Total: ~$35-55**

**Grand total first campaign: ~$400-420**

Comparable to Clay/Smartlead stack (~$390).

## Next skills (recommended path)

1. **Infrastructure setup**
   - `/domain-setup` — Dynadot + Zapmail domain/inbox provisioning
   - `/lemlist-inbox-manager` — Warmup, signatures, tagging

2. **Strategy**
   - `/icp-onboarding` — Lock down ICP → `client-profile.yaml`
   - `/lead-magnet-brainstorm` — What to offer for free
   - `/campaign-strategy` — 15-25 campaign ideas

3. **List building**
   - `/list-builder` — Meta skill: sweeps all sources, AI-qualifies, pulls contacts
   - Signal plays — `funding-signal`, `new-in-role`, etc.

4. **Copy & send**
   - `/campaign-copywriting` — Step-by-step copy writer
   - `/spam-word-checker` — Scan for deliverability killers
   - `/lemlist-campaign-upload` — Upload to Lemlist (DRAFT mode)

5. **Iterate**
   - Wait 21 days
   - `/reply-scoring` — Positive reply rate
   - `/weekly-rhythm` — Mon/Wed/Fri ops playbook

## Invoke

```
/kickoff
```

Answer the 3 questions, follow the menu.

## References

- Original skill: `skills/cold-email-kickoff/SKILL.md`
- Deepline port mapping: `deepline/PORT.md`
- Starter kit (detailed 14-step tutorial): `deepline/skills/starter-kit/SKILL.md`
