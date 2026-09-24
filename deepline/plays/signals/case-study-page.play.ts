/**
 * Case Study Page Play
 * 
 * Port of: skills/playbooks/playbook-case-study-page/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain
 * 2. CODE: candidate URL sweep (10 paths)
 * 3. Tool: scrape-website
 * 4. CODE: soft-404 guard
 * 5. Agent: extract client + detail
 * 6. CODE: five verbatim gates
 * 7. CODE: assemble line
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  domain: string;
  company_name: string;
}

interface Output {
  case_study_line: string;
  client_name: string;
  detail_phrase: string;
  confidence: 'high' | 'low';
}

// Candidate paths from SKILL.md
const CANDIDATE_PATHS = [
  '/case-studies', '/customers', '/customer-stories', '/success-stories',
  '/work', '/portfolio', '/clients', '/testimonials', '/case-study', '/examples'
];

// Dangling words to reject from detail_phrase
const DANGLING = new Set(['back', 'up', 'out', 'on', 'of', 'to', 'in', 'with']);

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 195-230) - VERBATIM
// Model: reasoning model with reasoning_effort low, 1200 tokens
// DO NOT PARAPHRASE. Graded prompt.
// ============================================================================
const LOCKED_PROMPT_CASE_STUDY = `You read a company's own case-study, customer-stories, or testimonials web page and pull out ONE named customer they publicly brag about.

You do NOT write the sentence. A script builds the sentence from your fields. Your only job is to pick the right customer and prove it is on the page.

Return JSON only, with exactly these keys:
{"client_name": "...", "evidence_quote": "...", "detail_phrase": "...", "confidence": "high|low"}

What each key means:
- client_name: the name of ONE customer company named on the page, spelled and capitalized exactly as the page spells it. Never the page owner. Never a partner directory, a press outlet, a review site, or a person's name. Pick the customer with the clearest story on the page.
- evidence_quote: 4 to 20 words copied character for character from the page text. It MUST contain client_name. It is what proves the customer is really named there.
- detail_phrase: 2 to 5 plain words naming the TOPIC of the work, and every word of it must appear inside evidence_quote. It is a noun phrase like "global spend management" or "first response time". It is never the customer's name, never a sentence fragment like "time back" or "hours saved", and never ends in a small word like back, up, out, on, of, to, with. If evidence_quote holds no clean topic, return "" here. An empty detail_phrase is a good answer, not a failure.
- confidence: "high" when the page clearly presents that company as a customer, "low" when it is only a logo with no story.

Rules:
- Never invent a customer, a number, or a result. If the page names no customer company, return "" for client_name and "" for the other fields.
- A page of unnamed praise ("Great service. - Dave R.") names no customer company. Return "".
- The examples below show SHAPE ONLY. Never copy a customer name, a number, a percentage, or a phrase out of the examples into your answer.
- detail_phrase never contains the page owner's own name, never contains a number the page does not state, and never sounds like bad news for the customer.
- 5th-grade reading level. No em dashes anywhere in the output.
- Ignore navigation text, cookie banners, menu items, and blog titles. Those are not customer stories.

Examples:
Input: page owner = zendesk.com, page text = "Customer stories. How Uber cut first response time by 30%. Read the Shopify story. [logo: Slack]"
Output: {"client_name": "Uber", "evidence_quote": "How Uber cut first response time by 30%", "detail_phrase": "first response time", "confidence": "high"}
Input: page owner = someagency.com, page text = "Our work. [logo: Peloton] [logo: Casper] [logo: Warby Parker]"
Output: {"client_name": "Peloton", "evidence_quote": "[logo: Peloton]", "detail_phrase": "", "confidence": "low"}
Input: page owner = acmeplumbing.com, page text = "Testimonials. Great service, fast and friendly. - Dave R. Highly recommend! - Sarah T."
Output: {"client_name": "", "evidence_quote": "", "detail_phrase": "", "confidence": "low"}

PER-ROW DATA (appended last)
Page owner company: <company name>
Page owner domain: <domain>
Page URL: <case study url>
Page text:
<page text>
`;

export const caseStudyPagePlay = definePlay<Input, Output>({
  name: 'case-study-page',
  version: '1.0.0',
  description: 'Case study page extraction with five verbatim gates and locked prompt',
  
  inputSchema: {
    type: 'object',
    required: ['domain', 'company_name'],
    properties: {
      domain: { type: 'string' },
      company_name: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      case_study_line: { type: 'string' },
      client_name: { type: 'string' },
      detail_phrase: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { domain, company_name } = ctx.input;
    
    // Node 2: CODE - candidate URL sweep
    let pageText = '';
    let caseStudyUrl = '';
    let finalPath = '';
    
    for (const path of CANDIDATE_PATHS) {
      try {
        const result = await ctx.tools.scrapeWebsite(`https://${domain}${path}`);
        if (result.status === 200 && result.content && result.content.length > 2000) {
          pageText = result.content;
          caseStudyUrl = `https://${domain}${path}`;
          finalPath = new URL(result.final_url || caseStudyUrl).pathname;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!pageText) {
      ctx.log('No case study page found');
      return {
        data: {
          case_study_line: '',
          client_name: '',
          detail_phrase: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'no_case_study_page' }
      };
    }
    
    // Node 4: CODE - soft-404 guard
    if (!finalPath.match(/case|customer|success|work|portfolio|client|testimonial|example/i)) {
      ctx.log(`Soft 404: final path ${finalPath} does not match case study pattern`);
      return {
        data: {
          case_study_line: '',
          client_name: '',
          detail_phrase: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'soft_404' }
      };
    }
    
    // Node 5: Agent extracts client + detail with LOCKED PROMPT
    const userMessage = `Page owner company: ${company_name}\nPage owner domain: ${domain}\nPage URL: ${caseStudyUrl}\nPage text:\n${pageText.slice(0, 14000)}`;
    
    const aiResult = await ctx.tools.ai<{
      client_name: string;
      evidence_quote: string;
      detail_phrase: string;
      confidence: 'high' | 'low';
    }>({
      systemPrompt: LOCKED_PROMPT_CASE_STUDY,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['client_name', 'evidence_quote', 'detail_phrase', 'confidence'],
        properties: {
          client_name: { type: 'string' },
          evidence_quote: { type: 'string' },
          detail_phrase: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 1200,
      retries: 3
    });
    
    if (!aiResult.client_name) {
      return {
        data: {
          case_study_line: '',
          client_name: '',
          detail_phrase: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'no_client_found' }
      };
    }
    
    // Node 6: CODE - five verbatim gates
    // Gate 1: client_name appears verbatim in page text
    if (!pageText.includes(aiResult.client_name)) {
      ctx.log('Gate 1 failed: client_name not in page text');
      return {
        data: {
          case_study_line: '',
          client_name: aiResult.client_name,
          detail_phrase: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'gate1_failed' }
      };
    }
    
    // Gate 2: evidence_quote appears verbatim in page text
    if (!pageText.includes(aiResult.evidence_quote)) {
      ctx.log('Gate 2 failed: evidence_quote not in page text');
      return {
        data: {
          case_study_line: '',
          client_name: aiResult.client_name,
          detail_phrase: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'gate2_failed' }
      };
    }
    
    // Gate 3: evidence_quote contains client_name
    if (!aiResult.evidence_quote.includes(aiResult.client_name)) {
      ctx.log('Gate 3 failed: evidence_quote does not contain client_name');
      return {
        data: {
          case_study_line: '',
          client_name: aiResult.client_name,
          detail_phrase: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'gate3_failed' }
      };
    }
    
    // Gate 4: client_name is not a placeholder
    const placeholders = ['startup', 'university', 'company', 'partner', 'client'];
    if (placeholders.includes(aiResult.client_name.toLowerCase())) {
      ctx.log('Gate 4 failed: client_name is placeholder');
      return {
        data: {
          case_study_line: '',
          client_name: '',
          detail_phrase: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'gate4_failed' }
      };
    }
    
    // Gate 5: detail_phrase validation (if present)
    let detail = aiResult.detail_phrase;
    if (detail) {
      // Every content word must appear in evidence_quote
      const words = detail.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const quoteWords = aiResult.evidence_quote.toLowerCase().split(/\s+/);
      const allPresent = words.every(w => quoteWords.some(q => q.includes(w)));
      
      if (!allPresent) {
        ctx.log('Gate 5 failed: detail words not in evidence_quote');
        detail = ''; // Drop detail, keep client
      }
      
      // detail cannot equal client_name
      if (detail.toLowerCase() === aiResult.client_name.toLowerCase()) {
        detail = '';
      }
      
      // detail cannot end in dangling word
      const lastWord = detail.split(/\s+/).pop()?.toLowerCase() || '';
      if (DANGLING.has(lastWord)) {
        detail = '';
      }
    }
    
    // Node 7: CODE - assemble line
    let line = `your work with ${aiResult.client_name}`;
    if (detail && detail.split(/\s+/).length <= 5) {
      line += ` on ${detail}`;
    }
    
    if (line.split(/\s+/).length > 16) {
      line = `your work with ${aiResult.client_name}`; // Drop detail if too long
    }
    
    return {
      data: {
        case_study_line: line,
        client_name: aiResult.client_name,
        detail_phrase: detail,
        confidence: aiResult.confidence
      },
      metadata: {
        confidence: aiResult.confidence,
        abstained: false
      }
    };
  }
});

export default caseStudyPagePlay;
