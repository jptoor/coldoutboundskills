# Deepline Plays

Faithful TypeScript port of Eric Nowoslawski's Clay workflows from `growthenginenowoslawski/coldoutboundskills`.

## Overview

This directory contains Deepline "plays" - the TypeScript equivalent of Clay workflows. Each play faithfully implements one of the 19 signal playbooks, preserving:

- Node graph structure
- Guard and filter logic (as code, not AI)
- Output field names and abstain contracts
- Locked prompt requirements (noted in comments)
- Input schemas

## Quick Start

```typescript
import { warmIntrosPlay } from './plays/signals/warm-intros.play';

const result = await warmIntrosPlay.run({
  input: {
    source_domains: ['customer1.com', 'customer2.com'],
    client_domain: 'yourclient.com',
    allow_naming: false
  },
  tools: ctx.tools,
  db: ctx.db,
  sequencer: ctx.sequencer,
  log: console.log
});

console.log(result.data.warm_intro_line);
```

## Structure

```
deepline/
├── types/
│   └── play.ts           # Core type definitions (Play, PlayContext, etc.)
├── lib/
│   └── utils.ts          # Common utilities (normalize, qc, guards)
├── plays/
│   └── signals/
│       ├── warm-intros.play.ts        # ✅ Customer alumni workflow
│       ├── funding-signal.play.ts     # ✅ Fundraising with 12-month window
│       ├── new-in-role.play.ts        # ✅ New role signal
│       ├── company-name-cleaning.play.ts  # ✅ Name normalization
│       ├── first-name-cleaning.play.ts    # ✅ 6-guard name cleaning
│       ├── pricing-page.play.ts       # ✅ Pricing extraction
│       ├── hiring-surge.play.ts       # 🔶 Ratio + floors logic
│       ├── social-link-finding.play.ts    # 🔶 Precedence ladder
│       ├── case-study-page.play.ts    # 🔶 5 verbatim gates
│       └── [10 more to create]
├── PORT.md               # Detailed port status and fidelity notes
└── README.md             # This file
```

## Status Legend

- ✅ **Fully Ported**: Complete implementation with all logic
- 🔶 **Stub + Logic**: Core logic faithful, needs tool integration
- ⏳ **Todo**: Not yet created

## Stack Substitutions

Per user requirements:

| Clay | Deepline |
|---|---|
| Clay workflows | TypeScript plays |
| Smartlead/Instantly | Lemlist (interface stubbed) |
| Supabase | Deepline Customer DB + HubSpot |
| Clay actions | `ctx.tools.*` methods |

## Critical Bug Fixed

**warm-intros.play.ts**: Prior port invented LinkedIn mutual connections. Fixed to implement **member 2 (current-customer alumni) ONLY**, matching the Clay workflow exactly. See `PORT.md` for details.

## Implementation Principles

These plays are **not loose paraphrases**. They are faithful ports:

1. **Node graph order**: Each play's `run()` method follows its workflow's node sequence
2. **Guards as code**: Config checks, filters, and deterministic logic are TypeScript, not AI
3. **Output contracts**: Field names match workflows exactly
4. **Locked prompts**: Marked in comments where workflows specify them
5. **Abstain behavior**: Empty strings where workflows specify abstention
6. **No AI substitution**: warm-intros uses formula assembly (code), not an agent node

## Tool Integration Needs

To make these production-ready, implement:

- `ctx.tools.searchPeople()` - Prospeo equivalent
- `ctx.tools.enrichCompany()` - Company data API
- `ctx.tools.scrapeWebsite()` - Web scraping service
- `ctx.tools.ai()` - LLM calls with locked prompts
- `ctx.db.customers` - Deepline Customer DB
- `ctx.db.hubspot` - HubSpot integration
- `ctx.sequencer` - Lemlist API

## Testing

Each play should be tested with:

1. 5 test rows from real data
2. Verify output contracts match
3. Check guards fire correctly
4. Confirm abstain behavior

## Documentation

- **PORT.md**: Detailed port status, fidelity levels, and testing plan
- **clay-workflow.md files**: Original source of truth in `skills/playbooks/`
- **This README**: Quick start and overview

## License

MIT - matches upstream repository
