/**
 * Lookalikes Play
 * 
 * Port of: skills/playbooks/playbook-lookalikes/clay-workflow.md
 * 
 * TWO WORKFLOWS:
 * - Workflow A (DECOMPOSER): Run once per case study to extract attribute card
 * - Workflow B (JUDGE): Run per row to qualify companies against attribute card
 * 
 * Workflow A Graph:
 * 1. Trigger: case study + company profile + seller offer
 * 2. Agent A: DECOMPOSER with LOCKED PROMPT A
 * 
 * Workflow B Graph:
 * 1. Trigger: attribute card + company name/domain/description
 * 2. Agent B: JUDGE with LOCKED PROMPT B
 * 3. Tool: liveness check (homepage classification)
 * 4. Agent B (re-judge): Re-judge live sites on current content
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

// ============================================================================
// WORKFLOW A: DECOMPOSER (once per case study)
// ============================================================================

interface InputA {
  case_study_text: string;
  case_study_company_profile: string;
  seller_offer_summary: string;
}

interface OutputA {
  resonance_reasons: string[];
  industry_enum_candidates: string[];
  keywords_include: string[];
  keywords_exclude: string[];
  headcount_min: number;
  headcount_max: number;
  geography: string;
  descriptor: string;
  confidence: 'high' | 'low';
}

// ============================================================================
// LOCKED PROMPT A from SKILL.md §6 (lines 156-195) - VERBATIM
// Model: input-heavy, cheapest input rate at standard pricing
// Params: max_completion_tokens=300, never temperature, flex tier for batch
// DO NOT PARAPHRASE. Graded decompose prompt.
// ============================================================================
const LOCKED_PROMPT_A_DECOMPOSER = `STATIC PREFIX (byte-identical across calls, keep first)

You are a B2B list-building analyst. You will be given one customer case study, a profile
of the company the case study is about, and a summary of what the seller offers. Your job
is to explain why this story would resonate with a company, in attributes that a company
database can filter on.

Return JSON only:
{"resonance_reasons": ["..."], "industry_enum_candidates": ["..."], "keywords_include": ["..."],
 "keywords_exclude": ["..."], "headcount_min": 0, "headcount_max": 0, "geography": "...",
 "descriptor": "...", "confidence": "high|low"}

Rules:
- resonance_reasons: 2 to 5 short reasons, each one testable against a company description.
  "sells software to marketers" is testable. "is innovative" is not. Drop untestable ones.
- industry_enum_candidates: 2 to 4 CANDIDATE enum strings, ranked best first, for a human to
  bake off against total_count. Include the exact industry string the database assigns to the
  case-study company, but do NOT assume it is correct: databases often tag a software vendor
  by who it sells to. Rank first the enum that names what the company IS, then the database's
  own tag, then at most 2 adjacent ones.
- keywords_include: 3 to 6 phrases that name what the product IS. Prefer 2 and 3 word
  phrases. Never include a word so common in the category that every company carries it.
- keywords_exclude: words that pull in agencies, publishers, marketplaces, and staffing
  firms in the same topic space.
- descriptor: how to describe the case-study company in cold copy WITHOUT naming its brand,
  4 to 10 words, lowercase, no trailing period. It must read correctly inside this
  sentence: "We did this for DESCRIPTOR."
- Never invent a fact. If the case study does not say it, it is not a reason.
- No em dashes.

Examples:
Input: case study about an SMS and email marketing platform selling to consumer brands,
1,500 people, US; seller runs cold email campaigns for B2B software companies.
Output: {"resonance_reasons":["sells marketing technology as a product, not as a service","sells to marketing leaders at consumer brands","US company big enough to have a dedicated demand generation team"],"industry_enum_candidates":["Software Development","Advertising Services","Marketing Services"],"keywords_include":["marketing platform","marketing automation","customer engagement platform"],"keywords_exclude":["agency","staffing","conference"],"headcount_min":50,"headcount_max":2000,"geography":"United States","descriptor":"a marketing platform about your size","confidence":"high"}

PER-CASE-STUDY DATA (appended last)
Case study text: <case study text>
Case study company profile: <profile>
Seller offer summary: <offer summary>`;

export const lookalikesDecomposePlay = definePlay<InputA, OutputA>({
  name: 'lookalikes-decompose',
  version: '1.0.0',
  description: 'Lookalikes Workflow A: Decompose case study into attribute card (LOCKED PROMPT A)',
  
  inputSchema: {
    type: 'object',
    required: ['case_study_text', 'case_study_company_profile', 'seller_offer_summary'],
    properties: {
      case_study_text: { type: 'string' },
      case_study_company_profile: { type: 'string' },
      seller_offer_summary: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      resonance_reasons: { type: 'array', items: { type: 'string' } },
      industry_enum_candidates: { type: 'array', items: { type: 'string' } },
      keywords_include: { type: 'array', items: { type: 'string' } },
      keywords_exclude: { type: 'array', items: { type: 'string' } },
      headcount_min: { type: 'number' },
      headcount_max: { type: 'number' },
      geography: { type: 'string' },
      descriptor: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<InputA>): Promise<PlayOutput<OutputA>> {
    const { case_study_text, case_study_company_profile, seller_offer_summary } = ctx.input;
    
    // Workflow A Node 2: Agent A - DECOMPOSER with LOCKED PROMPT A
    const userMessage = `Case study text: ${case_study_text}\nCase study company profile: ${case_study_company_profile}\nSeller offer summary: ${seller_offer_summary}`;
    
    const result = await ctx.tools.ai<OutputA>({
      systemPrompt: LOCKED_PROMPT_A_DECOMPOSER,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['resonance_reasons', 'industry_enum_candidates', 'keywords_include', 'keywords_exclude', 'headcount_min', 'headcount_max', 'geography', 'descriptor', 'confidence'],
        properties: {
          resonance_reasons: { type: 'array', items: { type: 'string' } },
          industry_enum_candidates: { type: 'array', items: { type: 'string' } },
          keywords_include: { type: 'array', items: { type: 'string' } },
          keywords_exclude: { type: 'array', items: { type: 'string' } },
          headcount_min: { type: 'number' },
          headcount_max: { type: 'number' },
          geography: { type: 'string' },
          descriptor: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 300, // max_completion_tokens
      retries: 3
    });
    
    return {
      data: result,
      metadata: {
        confidence: result.confidence,
        abstained: result.confidence === 'low'
      }
    };
  }
});

// ============================================================================
// WORKFLOW B: JUDGE (per row)
// ============================================================================

interface InputB {
  attribute_card: {
    resonance_reasons: string[];
    case_study_ref: string;
  };
  company_name: string;
  domain: string;
  company_description: string;
}

interface OutputB {
  qualified: boolean;
  case_study_ref: string;
  case_study_match_reason: string;
  confidence: 'high' | 'low';
}

// ============================================================================
// LOCKED PROMPT B from SKILL.md §6 (lines 199-235) - VERBATIM
// Model: input-heavy, cheapest input rate at standard pricing
// Params: max_completion_tokens=300, never temperature, flex tier for batch
// DO NOT PARAPHRASE. Graded judge prompt.
// ============================================================================
const LOCKED_PROMPT_B_JUDGE = `STATIC PREFIX (byte-identical across calls, keep first)

You are grading whether one company would recognise itself in a specific customer story.
You will be given the attribute card that defines the story's audience, and one company's
name and description.

Return JSON only:
{"qualified": true|false, "case_study_ref": "...", "case_study_match_reason": "...", "confidence": "high|low"}

Rules:
- qualified is the gate. Set qualified true and return the case_study_ref given in the
  attribute card ONLY if the company satisfies EVERY resonance reason in the card.
  Otherwise set qualified false and return "" for case_study_ref. These two always agree:
  qualified false always pairs with an empty case_study_ref, never with a non-empty one.
- A company in the right industry with the wrong product does not match. A services firm,
  agency, publisher, marketplace, or community does not match a software product story.
- case_study_match_reason: under 140 characters, quote the part of the description that
  decided it. Always populate it, on qualified false rows too.
  This is internal QA text, never sent to anyone.
- Never invent a fact about the company. Judge only what the description says. A thin or
  empty description means qualified false, case_study_ref "", and confidence "low".
- No em dashes.

Examples:
Input card reasons: ["sells marketing technology as a product","sells to marketing leaders"]. Company: Customer.io, "Create personalized customer journeys that engage and convert with our versatile customer engagement platform."
Output: {"qualified":true,"case_study_ref":"attentive","case_study_match_reason":"customer engagement platform sold as a product to marketing teams","confidence":"high"}
Input card reasons: ["sells marketing technology as a product","sells to marketing leaders"]. Company: Fivetran, "Fivetran, the global leader in data movement, helps customers use their data to power everything from AI applications to analytics."
Output: {"qualified":false,"case_study_ref":"","case_study_match_reason":"data movement infrastructure, not marketing technology","confidence":"high"}

PER-ROW DATA (appended last)
Attribute card: <attribute card>
Company: <company name>
Domain: <domain>
Description: <company description>`;

export const lookalikesJudgePlay = definePlay<InputB, OutputB>({
  name: 'lookalikes-judge',
  version: '1.0.0',
  description: 'Lookalikes Workflow B: Judge company against attribute card (LOCKED PROMPT B) with liveness check',
  
  inputSchema: {
    type: 'object',
    required: ['attribute_card', 'company_name', 'domain', 'company_description'],
    properties: {
      attribute_card: {
        type: 'object',
        required: ['resonance_reasons', 'case_study_ref'],
        properties: {
          resonance_reasons: { type: 'array', items: { type: 'string' } },
          case_study_ref: { type: 'string' }
        }
      },
      company_name: { type: 'string' },
      domain: { type: 'string' },
      company_description: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      qualified: { type: 'boolean' },
      case_study_ref: { type: 'string' },
      case_study_match_reason: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<InputB>): Promise<PlayOutput<OutputB>> {
    const { attribute_card, company_name, domain, company_description } = ctx.input;
    
    // Workflow B Node 2: Agent B - JUDGE with LOCKED PROMPT B (database description)
    const cardStr = `resonance_reasons: ${JSON.stringify(attribute_card.resonance_reasons)}, case_study_ref: "${attribute_card.case_study_ref}"`;
    const userMessage = `Attribute card: ${cardStr}\nCompany: ${company_name}\nDomain: ${domain}\nDescription: ${company_description}`;
    
    const judgeResult = await ctx.tools.ai<OutputB>({
      systemPrompt: LOCKED_PROMPT_B_JUDGE,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['qualified', 'case_study_ref', 'case_study_match_reason', 'confidence'],
        properties: {
          qualified: { type: 'boolean' },
          case_study_ref: { type: 'string' },
          case_study_match_reason: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 300,
      retries: 3
    });
    
    if (!judgeResult.qualified) {
      return {
        data: judgeResult,
        metadata: { abstained: true, reason: 'judge_rejected', confidence: judgeResult.confidence }
      };
    }
    
    // Workflow B Node 3: Tool - liveness check (homepage classification)
    // Database descriptions outlive the business. Fetch and classify homepage.
    let homepageContent = '';
    let homepageStatus = 'unknown';
    
    try {
      const homepage = await ctx.tools.scrapeWebsite(`https://${domain}`);
      homepageStatus = homepage.status === 200 ? 'live' : 'dead';
      homepageContent = homepage.content || '';
    } catch (e) {
      homepageStatus = 'dead';
    }
    
    // Classify: dead, parked, or live
    const isDead = homepageStatus === 'dead' || 
                   homepageContent.length < 1000 ||
                   /domain.*for sale|parked domain|this domain may be for sale/i.test(homepageContent);
    
    if (isDead) {
      ctx.log('Liveness check: site is dead or parked');
      return {
        data: {
          qualified: false,
          case_study_ref: '',
          case_study_match_reason: 'site is dead or parked',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'site_dead_or_parked' }
      };
    }
    
    // Workflow B Node 4: Agent B (re-judge) - Re-judge live sites on current homepage content
    const reJudgeMessage = `Attribute card: ${cardStr}\nCompany: ${company_name}\nDomain: ${domain}\nDescription: ${homepageContent.slice(0, 3000)}`;
    
    const reJudgeResult = await ctx.tools.ai<OutputB>({
      systemPrompt: LOCKED_PROMPT_B_JUDGE,
      userPrompt: reJudgeMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['qualified', 'case_study_ref', 'case_study_match_reason', 'confidence'],
        properties: {
          qualified: { type: 'boolean' },
          case_study_ref: { type: 'string' },
          case_study_match_reason: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 300,
      retries: 3
    });
    
    return {
      data: reJudgeResult,
      metadata: {
        confidence: reJudgeResult.confidence,
        abstained: !reJudgeResult.qualified
      }
    };
  }
});

// Export both workflows
export default {
  decompose: lookalikesDecomposePlay,
  judge: lookalikesJudgePlay
};
