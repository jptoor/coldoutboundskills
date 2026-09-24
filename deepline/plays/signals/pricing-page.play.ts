/**
 * Pricing Page Play
 * 
 * Port of: skills/playbooks/playbook-pricing-page/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain
 * 2. CODE: candidate URL sweep (10 paths)
 * 3. Tool: scrape-website with price-dense window
 * 4. CODE: soft-404 guard (final path check)
 * 5. Agent: extract pricing
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  domain: string;
}

interface Output {
  pricing_public: boolean;
  pricing_model: 'per_seat' | 'usage' | 'flat' | 'credits' | 'quote_only' | 'unknown';
  plans: Array<{ name: string; price: string; period: string }>;
  lowest_paid_price: string;
  has_free_tier: boolean;
  enterprise_quote_only: boolean;
  confidence: 'high' | 'low';
}

// Candidate paths from SKILL.md §3
const CANDIDATE_PATHS = [
  '/pricing', '/plans', '/price', '/pricing-plans', '/pricing/',
  '/plans/', '/price/', '/buy', '/purchase', '/subscribe'
];

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 210-250) - VERBATIM
// Model: reasoning model with reasoning_effort="low", 6000 tokens
// DO NOT PARAPHRASE. Graded prompt.
// ============================================================================
const LOCKED_PROMPT_PRICING = `You are a B2B pricing-page analyst. You will be given the visible text of one company's pricing page, scraped from their website.

Your job is to decide whether this company publishes real, self-serve pricing, and to extract the plan structure. This is used to FILTER a prospect list, so a wrong "yes" is worse than an honest "no".

Return JSON only, with exactly these keys:
{"pricing_public": true|false, "pricing_model": "per_seat"|"usage"|"flat"|"credits"|"quote_only"|"unknown", "plans": [{"name": "...", "price": "...", "period": "month"|"year"|"one_time"|"unknown"}], "lowest_paid_price": "...", "has_free_tier": true|false, "enterprise_quote_only": true|false, "feature_diff_axis": "...", "pricing_line": "...", "confidence": "high"|"low"}

Rules:
- pricing_public is true ONLY if at least one plan shows a real currency amount on the page. A page that says "Contact sales" or "Request a quote" for every plan is pricing_public false with pricing_model "quote_only".
- Never invent a number. If a price is not in the input text, leave it out. Do not estimate.
- plans lists at most 6 plans, in the order shown on the page. Free tiers count as a plan with price "$0".
- Attach each price to the plan name it sits directly under on the page. Never shift a price up or down to the neighbouring plan. If you cannot tell which plan a number belongs to, leave that plan's price as "" instead of guessing.
- When a plan lists several seat types (full seat, dev seat, collaborator seat), use the FULL seat price for that plan and ignore the cheaper seat types.
- Take a price only from the plan card it belongs to. Ignore numbers that appear in body copy, footnotes or FAQs, such as a minimum invoice spend, an annual contract minimum, or a savings claim. If a plan says "Contact us" or "Talk to sales", its price is "" even when a large number appears in a sentence nearby.
- When a page shows a struck-through list price next to a limited-time promotional price ("50% off for 3 months"), use the LIST price, not the promotional one. A promo expires and would date the email.
- If the ONLY price shown for a plan is an introductory or limited-time rate ("$13/mo for 12 months", "first year", "then, starts at"), report that price, set confidence to "low", and leave pricing_line empty. An intro rate quoted as if it were the list price is a wrong claim in the prospect's inbox.
- lowest_paid_price is the cheapest list price a customer can actually pay, excluding free tiers and excluding promotions. Empty string if none is shown.
- feature_diff_axis is the single thing that changes between tiers, in 6 words or fewer, for example "seats and automation limits" or "monthly lead credits".
- pricing_line must read grammatically inside this sentence: "Noticed <pricing_line>." Write ONLY the part that replaces <pricing_line>. Do not write the word "Noticed" yourself, do not repeat the sentence frame, start with a lowercase letter, and do not end with a period. Keep it at a 5th-grade reading level.
- pricing_line names something only this company would recognise, such as the plan name plus its price. "pricing starts at $0 for the free plan" is too generic to use, so prefer the cheapest PAID plan.
- Only state a billing period in pricing_line if the page states one. If the page prices per unit with no period, say the unit, not "per month".
- No em dashes anywhere in your output. Use a comma or split the sentence.
- If the input text is a cookie banner, a login wall, a navigation shell, or is otherwise too thin to judge, return pricing_public false, pricing_model "unknown", confidence "low", and "" for pricing_line. Do not guess from the company name.

Examples (these four pages are invented, from companies that do not exist, so that no
example can ever hand you the answer to a page you are actually being asked to read):
Input: Northwind Ledger Pricing Starter $0 Free for small teams 3 workspaces Standard $7 per user/month Team $23 per user/month Enterprise Talk to us
Output: {"pricing_public": true, "pricing_model": "per_seat", "plans": [{"name": "Starter", "price": "$0", "period": "month"}, {"name": "Standard", "price": "$7", "period": "month"}, {"name": "Team", "price": "$23", "period": "month"}, {"name": "Enterprise", "price": "", "period": "unknown"}], "lowest_paid_price": "$7", "has_free_tier": true, "enterprise_quote_only": true, "feature_diff_axis": "seats and workspace limits", "pricing_line": "your Standard plan runs $7 a user each month", "confidence": "high"}

Input: Halden Systems Pricing Every deployment is scoped with our team. Book a walkthrough Request a quote Talk to sales
Output: {"pricing_public": false, "pricing_model": "quote_only", "plans": [], "lowest_paid_price": "", "has_free_tier": false, "enterprise_quote_only": true, "feature_diff_axis": "", "pricing_line": "", "confidence": "high"}

Input: Crate Studio Plans Sketch Includes: unlimited boards Studio Monthly Annual Full seat $29 /mo Builder seat $14 /mo Viewer seat $4 /mo Atelier Billed annually Full seat $68 /mo Builder seat $31 /mo Enterprise Full seat $115 /mo
Output: {"pricing_public": true, "pricing_model": "per_seat", "plans": [{"name": "Sketch", "price": "$0", "period": "month"}, {"name": "Studio", "price": "$29", "period": "month"}, {"name": "Atelier", "price": "$68", "period": "month"}, {"name": "Enterprise", "price": "$115", "period": "month"}], "lowest_paid_price": "$29", "has_free_tier": true, "enterprise_quote_only": false, "feature_diff_axis": "seat type and board limits", "pricing_line": "your Studio plan is $29 a seat each month", "confidence": "high"}

Input: Ferrous Growth Run every campaign in one place 30% off for the first year* $62 $43.40 USD per workspace / month, when paying monthly $54 USD per workspace / month, when paying annually
Output: {"pricing_public": true, "pricing_model": "flat", "plans": [{"name": "Growth", "price": "$62", "period": "month"}], "lowest_paid_price": "$62", "has_free_tier": false, "enterprise_quote_only": false, "feature_diff_axis": "billing period", "pricing_line": "your Growth plan lists at $62 a workspace each month", "confidence": "high"}

PER-ROW DATA (appended last)
PAGE DATA
Domain: <domain>
Pricing URL: <pricing url>
Visible page text:
<text>`;

export const pricingPagePlay = definePlay<Input, Output>({
  name: 'pricing-page',
  version: '1.0.0',
  description: 'Pricing page extraction with soft-404 guard and locked prompt',
  
  inputSchema: {
    type: 'object',
    required: ['domain'],
    properties: {
      domain: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      pricing_public: { type: 'boolean' },
      pricing_model: { type: 'string' },
      plans: { type: 'array' },
      lowest_paid_price: { type: 'string' },
      has_free_tier: { type: 'boolean' },
      enterprise_quote_only: { type: 'boolean' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { domain } = ctx.input;
    
    // Node 2: CODE - candidate URL sweep
    let pageText = '';
    let pricingUrl = '';
    let finalPath = '';
    
    for (const path of CANDIDATE_PATHS) {
      try {
        const result = await ctx.tools.scrapeWebsite(`https://${domain}${path}`);
        if (result.status === 200 && result.content && result.content.length > 2000) {
          pageText = result.content;
          pricingUrl = `https://${domain}${path}`;
          finalPath = new URL(result.final_url || pricingUrl).pathname;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!pageText) {
      ctx.log('No pricing page found in candidate paths');
      return {
        data: {
          pricing_public: false,
          pricing_model: 'unknown',
          plans: [],
          lowest_paid_price: '',
          has_free_tier: false,
          enterprise_quote_only: false,
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'no_pricing_page' }
      };
    }
    
    // Node 4: CODE - soft-404 guard (final path check)
    // Require final path to still match /pricing|plans|price/
    if (!finalPath.match(/pricing|plans|price/i)) {
      ctx.log(`Soft 404: final path ${finalPath} does not match pricing pattern`);
      return {
        data: {
          pricing_public: false,
          pricing_model: 'unknown',
          plans: [],
          lowest_paid_price: '',
          has_free_tier: false,
          enterprise_quote_only: false,
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'soft_404' }
      };
    }
    
    // Use price-dense sliding window (not first N chars)
    const windowSize = 14000;
    let bestWindow = pageText.slice(0, windowSize);
    const pricePattern = /\$\d+/g;
    let maxPriceCount = (bestWindow.match(pricePattern) || []).length;
    
    for (let i = windowSize; i < pageText.length; i += windowSize / 2) {
      const window = pageText.slice(i, i + windowSize);
      const count = (window.match(pricePattern) || []).length;
      if (count > maxPriceCount) {
        maxPriceCount = count;
        bestWindow = window;
      }
    }
    
    // Node 5: Agent extracts pricing with LOCKED PROMPT
    const userMessage = `PAGE DATA\nDomain: ${domain}\nPricing URL: ${pricingUrl}\nVisible page text:\n${bestWindow}`;
    
    const result = await ctx.tools.ai<Output & {feature_diff_axis: string; pricing_line: string}>({
      systemPrompt: LOCKED_PROMPT_PRICING,
      userPrompt: userMessage,
      jsonMode: true,
      maxTokens: 6000,
      // reasoning_effort: "low"
      retries: 3
    });
    
    return {
      data: {
        pricing_public: result.pricing_public,
        pricing_model: result.pricing_model,
        plans: result.plans,
        lowest_paid_price: result.lowest_paid_price,
        has_free_tier: result.has_free_tier,
        enterprise_quote_only: result.enterprise_quote_only,
        confidence: result.confidence
      },
      metadata: {
        confidence: result.confidence,
        abstained: !result.pricing_public
      }
    };
  }
});

export default pricingPagePlay;
