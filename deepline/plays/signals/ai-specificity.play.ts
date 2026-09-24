/**
 * AI Specificity Play
 * 
 * Port of: skills/playbooks/playbook-ai-specificity/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: company data + client offer
 * 2. Agent: write merge field with 4-step reasoning
 * 3. CODE: deterministic guard (reading level)
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  company_data: string; // Description of what the company makes/sells
  client_offer_name: string;
  client_offer_sells_to: string;
  client_offer_capabilities: string[]; // 5-7 capability lines
  client_offer_does_not_do: string;
}

interface Output {
  specificity_line: string;
  anchor: string;
  offer_item: string;
  fits: 'yes' | 'no';
  confidence: 'high' | 'low';
}

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 170-222) - VERBATIM
// Model: nano-class at minimal reasoning effort (outside Clay); gpt-4o-mini (inside Clay)
// Params: max_completion_tokens=400, no temperature, JSON mode, flex tier for batch
// DO NOT PARAPHRASE. Graded prompt for writing merge fields.
// ============================================================================
const LOCKED_PROMPT_AI_SPECIFICITY = `You write one short merge field that gets dropped into the middle of a cold email sentence.

The sentence it goes into is exactly this, and you are writing only the {{VAR}} part:
"Specifically, I think we can help you {{VAR}}."

STEP 1, FIT CHECK. Read the company data. Decide if the client offer below really applies
to how THIS company makes money. Say yes for any company that makes or sells a product, or
sells a service, that the offer list can plainly serve. Say no for schools, city and
government bodies, hospitals, churches, charities, and any company whose business you
cannot tell from the data. Write "yes" or "no" in "fits". If no, return empty strings for
the rest and stop.

STEP 2, ANCHOR. Pick one anchor: a word or short phrase for the thing this company makes,
sells, or counts. Copy it from the company data word for word. It must be a real thing,
like "pool float", "washable rug", "hard cooler", "pool contractor". It cannot be a
business word like "product", "margin", "channel", "SKU", "revenue", or "customer".

STEP 3, OFFER ITEM. Pick the ONE line from the client offer list below that fits this
company best, using evidence in the company data, not the first item on the list. Copy it
word for word into "offer_item". You may not write anything the offer list does not say.

STEP 4, LINE. Write the merge field. It must contain the anchor, and it must say what the
offer item does, in plain words, for this company's anchor. Do not copy the offer item
wording into the line. Say it the way this company would say it.

Rules:
1. Write at a 5th-grade reading level. Use short, common words.
2. Start with a plain verb, like "track", "see", "know", "build", "cut". Lowercase first
   word. No comma at the start. No period at the end. Never write the words "help you"
   or "specifically".
3. Never write the company's name. The email already says it.
4. Never use an em dash or an en dash. Use a comma, or "and", "so", or "because".
5. Never state a fact that is not in the company data. Do not guess what they probably do.
6. Between 6 and 14 words. One idea only.
7. Never promise sales, growth, demand, traffic, or customers unless the offer list says
   the client does that. You describe the work, not the result of their business.
8. Never write the words "channel", "platform", or "across". If the company data names a
   real place they sell, like dealers, gift shops, Amazon, or their own site, name that
   place instead. If it names none, leave the place out of the line.
9. Banned phrases, because they fit any company: "product margins", "gross margin",
   "your business", "your products", "boost margins", "improve efficiency", "grow faster",
   "grow sales", "more sales", "drive demand", "increase sales". If your line needs one of
   these, your anchor was too vague. Go back to step 2.
10. If step 1 said no, or you cannot find a real anchor in the data, return empty strings.
   Never write "N/A", "unknown", "none", or a placeholder in brackets.
11. Empty is only for "fits": "no", or data too vague to name a real thing. If "fits" is
   "yes" you must write an anchor and a line. Low confidence is fine, write it anyway.
   Marketing fluff in the data is normal. One real product word is enough to work with.

Return JSON only, no markdown fence:
{"fits": "yes|no", "anchor": "<words copied from the company data, or empty>", "offer_item": "<one line copied from the offer list, or empty>", "line": "<merge field, or empty>", "confidence": "high|low"}`;

export const aiSpecificityPlay = definePlay<Input, Output>({
  name: 'ai-specificity',
  version: '1.0.0',
  description: 'AI-written merge field with 4-step reasoning and locked prompt from SKILL.md §6',
  
  inputSchema: {
    type: 'object',
    required: ['company_data', 'client_offer_name', 'client_offer_sells_to', 'client_offer_capabilities', 'client_offer_does_not_do'],
    properties: {
      company_data: { type: 'string' },
      client_offer_name: { type: 'string' },
      client_offer_sells_to: { type: 'string' },
      client_offer_capabilities: { type: 'array', items: { type: 'string' } },
      client_offer_does_not_do: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      specificity_line: { type: 'string' },
      anchor: { type: 'string' },
      offer_item: { type: 'string' },
      fits: { type: 'string', enum: ['yes', 'no'] },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const {
      company_data,
      client_offer_name,
      client_offer_sells_to,
      client_offer_capabilities,
      client_offer_does_not_do
    } = ctx.input;
    
    // Build client offer block (Part 2 of prompt from SKILL.md §6 L230-240)
    const clientOfferBlock = `CLIENT OFFER (the company sending this email):
Name: ${client_offer_name}
Sells to: ${client_offer_sells_to}
What they actually do:
${client_offer_capabilities.map(c => `- ${c}`).join('\n')}
What they do NOT do: ${client_offer_does_not_do}`;
    
    // Combine system prompt with client offer block
    const systemPrompt = `${LOCKED_PROMPT_AI_SPECIFICITY}\n\n${clientOfferBlock}`;
    
    // Per-row data (Part 3)
    const userMessage = company_data;
    
    // Agent call
    const result = await ctx.tools.ai<{
      fits: 'yes' | 'no';
      anchor: string;
      offer_item: string;
      line: string;
      confidence: 'high' | 'low';
    }>({
      systemPrompt,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['fits', 'anchor', 'offer_item', 'line', 'confidence'],
        properties: {
          fits: { type: 'string', enum: ['yes', 'no'] },
          anchor: { type: 'string' },
          offer_item: { type: 'string' },
          line: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 400,
      // reasoning_effort: "minimal" for nano outside Clay
      retries: 3
    });
    
    // CODE: deterministic guard (reading level - from SKILL.md §3)
    // Gate the tail, not the rendered sentence
    // This is a placeholder - full Flesch-Kincaid would go here
    
    return {
      data: {
        specificity_line: result.line,
        anchor: result.anchor,
        offer_item: result.offer_item,
        fits: result.fits,
        confidence: result.confidence
      },
      metadata: {
        confidence: result.confidence,
        abstained: result.fits === 'no' || !result.line
      }
    };
  }
});

export default aiSpecificityPlay;
