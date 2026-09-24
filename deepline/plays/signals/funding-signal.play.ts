/**
 * Funding Signal Play (Fundraising)
 * 
 * Port of: skills/playbooks/playbook-fundraising/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain
 * 2. Company lookup by domain
 * 3. Domain guard + stage filter + 12-month window (CODE decides truth)
 * 4. Agent: write the clause (only when eligible)
 * 5. Wrap into sentence + contract (CODE wraps)
 * 
 * Design principle: Node 3 decides truth, node 4 decides wording.
 * Model is structurally incapable of inventing a round.
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';
import { monthsSince, formatCurrency } from '../../lib/utils';

interface FundingSignalInput {
  domain: string;
}

interface FundingSignalOutput {
  funding_line: string;
  funding_clause: string;
  funding_evidence_url: string;
  funding_confidence: 'high' | 'medium' | 'low';
  company: string;
}

interface FundingRecord {
  company: string;
  amount: string;
  stage: string;
  eligible: boolean;
  evidence_url: string;
  confidence: 'high' | 'low';
}

// EQUITY stages only - secondary sales and PE purchases are excluded
const EQUITY_STAGES = new Set([
  'Pre seed', 'Seed', 'Series unknown', 'Series A', 'Series B', 'Series C',
  'Series D', 'Series E-J', 'Angel', 'Corporate round', 'Convertible note',
  'Equity crowdfunding'
]);

// Database bucket labels, not round names anyone says out loud
const UNSPEAKABLE = new Set(['Series E-J', 'Series unknown']);

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 192-223) - VERBATIM, graded at 8/10
// DO NOT PARAPHRASE. Model was graded on this exact text.
// ============================================================================
const LOCKED_PROMPT_FUNDRAISING = `You write one short clause about a funding round for a cold email.

You will be given a JSON record for one company. Every fact in it has already been
checked. Your only job is wording. Do not do arithmetic and do not add facts.

Return JSON only, exactly these keys:
{"funding_line": "...", "evidence_url": "...", "confidence": "high|low"}

Rules:
- If eligible is false, return "" for funding_line and "low" for confidence. Nothing else.
- The clause must read grammatically inside this sentence: "Saw <funding_line>."
- Start with a lowercase letter. No trailing period. No em dashes. No quote marks.
- 5th-grade reading level. Under 80 characters.
- Use amount exactly as written in the record. Never change the number.
- If stage is not empty, name it. If stage is empty, say "round" instead.
- Never name a month, a season, a year, or a date. Never say "recently".
- Never mention total funding, valuation, or investors.
- Copy evidence_url from the record. Set confidence to the value in the record.

Examples:
Input: {"company":"Attio","amount":"$52M","stage":"Series B","eligible":true,"evidence_url":"https://www.crunchbase.com/funding_round/attio-series-b","confidence":"high"}
Output: {"funding_line":"you raised $52M in the Series B","evidence_url":"https://www.crunchbase.com/funding_round/attio-series-b","confidence":"high"}
Input: {"company":"Deel","amount":"$300M","stage":"","eligible":true,"evidence_url":"https://www.crunchbase.com/organization/deel","confidence":"high"}
Output: {"funding_line":"you closed a $300M round","evidence_url":"https://www.crunchbase.com/organization/deel","confidence":"high"}
Input: {"company":"Northwind Labs","amount":"","stage":"Series A","eligible":true,"evidence_url":"https://www.crunchbase.com/organization/northwind-labs","confidence":"high"}
Output: {"funding_line":"you closed the Series A","evidence_url":"https://www.crunchbase.com/organization/northwind-labs","confidence":"high"}
Input: {"company":"Acme Widgets","amount":"","stage":"","eligible":false,"evidence_url":"","confidence":"low"}
Output: {"funding_line":"","evidence_url":"","confidence":"low"}

PER-ROW DATA (appended last, as the user message)
<the eligibility record>`;

export const fundingSignalPlay = definePlay<FundingSignalInput, FundingSignalOutput>({
  name: 'funding-signal',
  version: '1.0.0',
  description: 'Fundraising signal with 12-month window and equity-only filter',
  
  inputSchema: {
    type: 'object',
    required: ['domain'],
    properties: {
      domain: { type: 'string', description: 'Company domain' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      funding_line: { type: 'string' },
      funding_clause: { type: 'string' },
      funding_evidence_url: { type: 'string' },
      funding_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      company: { type: 'string' }
    }
  },
  
  async run(ctx: PlayContext<FundingSignalInput>): Promise<PlayOutput<FundingSignalOutput>> {
    const { domain } = ctx.input;
    
    // Node 2: COMPANY LOOKUP
    // TODO: Implement against actual enrichment tool
    const companyData = await ctx.tools.enrichCompany(domain.trim().toLowerCase());
    
    // Node 3: THE THREE GUARDS
    const record: FundingRecord = {
      company: '',
      amount: '',
      stage: '',
      eligible: false,
      evidence_url: '',
      confidence: 'low'
    };
    
    // GUARD 1: Domain equality
    // A website filter also matches OTHER listed websites, so a vendor that lists
    // your target as a customer can win the match, silently.
    if (!companyData || (companyData.domain || '').toLowerCase() !== domain.trim().toLowerCase()) {
      ctx.log('Guard 1 failed: domain mismatch');
      return abstainResult(record);
    }
    
    record.company = companyData.name || '';
    
    // GUARD 2: Equity stages only
    // Secondary-market sales and PE stake purchases are money moving between
    // SHAREHOLDERS, not into the company. Calling either a raise is a false claim.
    const events = companyData.funding?.events || [];
    const eligible = events.filter(e => EQUITY_STAGES.has(e.stage));
    
    if (eligible.length === 0) {
      ctx.log('Guard 2 failed: no equity events');
      return abstainResult(record);
    }
    
    // Sort by date, take latest
    const latest = eligible.sort((a, b) => 
      (b.raised_at || '').localeCompare(a.raised_at || '')
    )[0];
    
    // GUARD 3: The 12-month window, computed HERE so the model never does arithmetic
    const months = monthsSince(latest.raised_at);
    if (months < 0 || months > 12) {
      ctx.log('Guard 3 failed: outside 12-month window, months =', months);
      return abstainResult(record);
    }
    
    const amt = latest.amount || 0;
    record.amount = formatCurrency(amt);
    
    const stage = latest.stage || '';
    record.stage = UNSPEAKABLE.has(stage) ? '' : stage;
    record.evidence_url = latest.url || '';
    record.confidence = 'high';
    record.eligible = true;
    
    ctx.log('Eligible for funding signal:', record);
    
    // Node 4: AGENT - write the clause using LOCKED PROMPT (verbatim from SKILL.md §6)
    // ✅ FULL PARITY: Uses graded prompt, exact JSON schema, correct params
    const aiResult = await ctx.tools.ai<{
      funding_line: string;
      evidence_url: string;
      confidence: string;
    }>({
      systemPrompt: LOCKED_PROMPT_FUNDRAISING,
      userPrompt: JSON.stringify(record),
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['funding_line', 'evidence_url', 'confidence'],
        properties: {
          funding_line: { type: 'string' },
          evidence_url: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] } // Note: 'medium' not in locked prompt
        }
      },
      maxTokens: 3000, // max_completion_tokens per SKILL.md
      retries: 3 // Truncation guard: finish_reason=length with empty content means retry
    });
    
    // Node 5: WRAP AND CONTRACT
    let clause = (aiResult.funding_line || '').trim();
    
    // Strip trailing period from clause if present
    if (clause.endsWith('.')) {
      clause = clause.slice(0, -1);
    }
    
    // The wrap happens in CODE. The model never writes the finished sentence, so the
    // leading "Saw" and the trailing period cannot be forgotten or hallucinated.
    const funding_line = clause ? `Saw ${clause}.` : '';
    
    return {
      data: {
        funding_clause: clause,
        funding_line: funding_line,
        funding_evidence_url: clause ? (aiResult.evidence_url || record.evidence_url) : '',
        funding_confidence: clause ? (aiResult.confidence as any || 'low') : 'low',
        company: record.company
      },
      metadata: {
        confidence: clause ? 'high' : 'low',
        abstained: !clause,
        evidence: record.evidence_url
      }
    };
  }
});

function abstainResult(record: FundingRecord): PlayOutput<FundingSignalOutput> {
  return {
    data: {
      funding_line: '',
      funding_clause: '',
      funding_evidence_url: '',
      funding_confidence: 'low',
      company: record.company
    },
    metadata: {
      confidence: 'low',
      abstained: true
    }
  };
}

export default fundingSignalPlay;
