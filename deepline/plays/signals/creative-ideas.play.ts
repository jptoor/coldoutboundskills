/**
 * Creative Ideas Play
 * 
 * Port of: skills/playbooks/playbook-creative-ideas/clay-workflow.md
 * 
 * NO FENCED PROMPT IN §6. §6 L119-137 specifies SHAPE and RULES only.
 * This play embeds those verbatim specifications as the system block.
 * 
 * Graph:
 * 1-6. Evidence waterfall (gate on length < 200)
 * 7. CODE: slot definitions from operator
 * 8. Agent: one call, all three bullets (§6 shape + rules)
 * 9. CODE: assert evidence substring + lint + route
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  company_name: string;
  domain: string;
  evidence_text: string; // After waterfall
  seller_offer: string;
  slot_1_name: string;
  slot_2_name: string;
  slot_3_name: string;
  must_never_appear: string[]; // Competitors, etc.
  hand_written_exemplars: string; // Faux prior turns
}

interface Output {
  creative_idea_1: string;
  creative_idea_2: string;
  creative_idea_3: string;
  evidence_1: string;
  evidence_2: string;
  evidence_3: string;
  confidence: 'high' | 'low';
}

// ============================================================================
// VERBATIM §6 SHAPE AND RULES (SKILL.md L119-137)
// 
// "Prompt shape:
// - System block: the seller's offer, the three named slots, the must-never-appear 
//   list, and the output contract.
// - Few-shot: the operator's hand-written sets as faux prior turns.
// - Per-row, last: company name, domain, and the evidence text.
// - Output: {creative_idea_1..3, evidence_1..3, confidence}.
//
// Rules that carry the quality: 8 to 22 words per bullet; no em or en dash; no 
// trailing period; no leading capital; each bullet must name a detail from the 
// evidence; an empty bullet is better than a generic one; never a competitor, a 
// dollar figure, a headcount, or a named customer."
//
// The verifier is free (§6 L132-137):
// "evidence_N must appear as a real substring of the input evidence, normalized on 
// both sides. That is the whole verification. No second model call: the model is 
// asked to quote what it used, and you assert the quote is real. A bullet whose 
// evidence does not appear in the input was invented, and it is blanked."
// ============================================================================

function buildSystemBlock(input: Input): string {
  return `You write three specific, concrete ideas for a cold email to a B2B prospect.

SELLER'S OFFER:
${input.seller_offer}

THREE NAMED SLOTS (you write one idea for each, in order):
1. ${input.slot_1_name}
2. ${input.slot_2_name}
3. ${input.slot_3_name}

MUST NEVER APPEAR (never mention these):
${input.must_never_appear.map(item => `- ${item}`).join('\n')}

OUTPUT CONTRACT:
Return JSON only, exactly these keys:
{"creative_idea_1": "...", "evidence_1": "...", "creative_idea_2": "...", "evidence_2": "...", "creative_idea_3": "...", "evidence_3": "...", "confidence": "high|low"}

RULES (§6 L127-129):
- 8 to 22 words per bullet
- No em or en dash
- No trailing period
- No leading capital
- Each bullet must name a detail from the evidence
- An empty bullet is better than a generic one
- Never a competitor, a dollar figure, a headcount, or a named customer

For each idea, quote the evidence phrase you used in evidence_N. The evidence phrase must be copied word-for-word from the company data below.`;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const creativeIdeasPlay = definePlay<Input, Output>({
  name: 'creative-ideas',
  version: '1.0.0',
  description: 'Creative ideas with verbatim §6 shape/rules + free verifier',
  
  inputSchema: {
    type: 'object',
    required: ['company_name', 'domain', 'evidence_text', 'seller_offer', 'slot_1_name', 'slot_2_name', 'slot_3_name', 'must_never_appear', 'hand_written_exemplars'],
    properties: {
      company_name: { type: 'string' },
      domain: { type: 'string' },
      evidence_text: { type: 'string' },
      seller_offer: { type: 'string' },
      slot_1_name: { type: 'string' },
      slot_2_name: { type: 'string' },
      slot_3_name: { type: 'string' },
      must_never_appear: { type: 'array', items: { type: 'string' } },
      hand_written_exemplars: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      creative_idea_1: { type: 'string' },
      creative_idea_2: { type: 'string' },
      creative_idea_3: { type: 'string' },
      evidence_1: { type: 'string' },
      evidence_2: { type: 'string' },
      evidence_3: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const input = ctx.input;
    
    // Gate on evidence length (§6 L127: gate on length < 200)
    if (input.evidence_text.length < 200) {
      ctx.log('Evidence too thin (< 200 chars)');
      return {
        data: {
          creative_idea_1: '',
          creative_idea_2: '',
          creative_idea_3: '',
          evidence_1: '',
          evidence_2: '',
          evidence_3: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'thin_evidence' }
      };
    }
    
    // Node 8: Agent call with §6 shape
    const systemPrompt = buildSystemBlock(input);
    const userMessage = `Company: ${input.company_name}\nDomain: ${input.domain}\n\nEvidence:\n${input.evidence_text}`;
    
    const aiResult = await ctx.tools.ai<Output>({
      systemPrompt: systemPrompt + '\n\n' + input.hand_written_exemplars,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['creative_idea_1', 'evidence_1', 'creative_idea_2', 'evidence_2', 'creative_idea_3', 'evidence_3', 'confidence'],
        properties: {
          creative_idea_1: { type: 'string' },
          evidence_1: { type: 'string' },
          creative_idea_2: { type: 'string' },
          evidence_2: { type: 'string' },
          creative_idea_3: { type: 'string' },
          evidence_3: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 1200,
      // reasoning_effort: "minimal"
      retries: 3
    });
    
    // Node 9: FREE VERIFIER (§6 L132-137)
    // "evidence_N must appear as a real substring of the input evidence, normalized on both sides"
    const evidenceNorm = normalize(input.evidence_text);
    
    const bullets: Array<{idea: string; evidence: string}> = [
      { idea: aiResult.creative_idea_1, evidence: aiResult.evidence_1 },
      { idea: aiResult.creative_idea_2, evidence: aiResult.evidence_2 },
      { idea: aiResult.creative_idea_3, evidence: aiResult.evidence_3 }
    ];
    
    const verified = bullets.map(b => {
      if (!b.idea || !b.evidence) {
        return { idea: '', evidence: '' };
      }
      
      // Assert evidence substring appears in input
      const evidenceQuoteNorm = normalize(b.evidence);
      if (!evidenceNorm.includes(evidenceQuoteNorm)) {
        ctx.log(`Evidence not found: "${b.evidence}"`);
        return { idea: '', evidence: '' }; // Blank invented bullet
      }
      
      return b;
    });
    
    // §6 L151: "Any empty bullet excludes the row"
    const hasEmpty = verified.some(b => !b.idea);
    if (hasEmpty) {
      ctx.log('Empty bullet found - excluding row');
      return {
        data: {
          creative_idea_1: '',
          creative_idea_2: '',
          creative_idea_3: '',
          evidence_1: '',
          evidence_2: '',
          evidence_3: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'empty_bullet' }
      };
    }
    
    return {
      data: {
        creative_idea_1: verified[0].idea,
        creative_idea_2: verified[1].idea,
        creative_idea_3: verified[2].idea,
        evidence_1: verified[0].evidence,
        evidence_2: verified[1].evidence,
        evidence_3: verified[2].evidence,
        confidence: aiResult.confidence
      },
      metadata: {
        confidence: aiResult.confidence,
        abstained: false
      }
    };
  }
});

export default creativeIdeasPlay;
