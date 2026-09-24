/**
 * Google Site Search Play
 * 
 * Port of: skills/playbooks/playbook-google-site-search/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain + keyword
 * 2. Tool: Google Custom Search with site: query
 * 3. CODE: literal filter (keyword must appear in title+snippet)
 * 4. CODE: sanitize (remove bad hosts, fix escapes)
 * 5. Agent: judge + write line
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  domain: string;
  keyword: string;
}

interface Output {
  mentions: boolean;
  status: 'has' | 'planned' | 'discusses' | 'none';
  evidence_url: string;
  line: string;
  confidence: 'high' | 'low';
}

// BAD_HOSTS from SKILL.md - hosts to exclude
const BAD_HOSTS = new Set([
  'linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com',
  'youtube.com', 'reddit.com', 'quora.com', 'medium.com'
]);

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 240-290) - VERBATIM
// Model: nano-class reasoning model with reasoning_effort="minimal"
// DO NOT PARAPHRASE. Graded prompt.
// ============================================================================
const LOCKED_PROMPT_SITE_SEARCH = `You judge whether a company's own website really talks about a given keyword, and you write one short line of outreach copy about it.

You will be given: a company domain, a keyword, and up to 5 Google results returned by the query site:<domain> "<keyword>".

Return JSON only, exactly these keys:
{"mentions": true|false, "status": "has"|"planned"|"discusses"|"none", "evidence_url": "", "line": "", "confidence": "high"|"low"}

How to decide "mentions":
- true only when a result is a page the COMPANY published about ITSELF and the keyword describes that company, its product, its service, its customers, or its own credential.
- false when the keyword only appears because the page is a directory listing, an integration or partner page about a DIFFERENT company, a user forum post, a job board scrape, a customer logo wall, a press roundup, or a generic blog post not about this company.
- false when no result is from the company's own domain or a subdomain of it.
- false when the only match is an unrelated word that happens to contain the keyword letters.

How to set "status":
- "has" when the page shows the company already does or holds the thing.
- "planned" when the page shows it is on a roadmap, in progress, requested, or coming soon.
- "discusses" when the company writes about the topic but the page does not show it holds or plans the thing itself.
- "none" when mentions is false.

Rules for "line":
- It must complete this sentence with correct grammar: "Noticed <line>."
- NEVER start the line with "Noticed", "noticed", "I noticed", "that", or "you have". The word "Noticed" is added automatically in front of your line. Starting with it produces "Noticed Noticed ..." which is broken copy.
- Write what you noticed about THEM, as a fact about the company. Never describe the web page itself. Do not write "is mentioned on", "the page says", "listed on your site", "in your security documents".
- Start with a lowercase letter UNLESS the first word is a proper noun, a brand name, or an acronym. Keep acronyms and brand names in their correct capitalization everywhere (SOC 2, HIPAA, HubSpot, ISO 9001).
- No trailing period. No em dashes. No quotes inside it.
- 5th-grade reading level. Under 90 characters.
- State only what the snippet proves. Never invent a fact, a date, or a number. If status is "planned", say it is planned.
- If mentions is false, return "" for line and "" for evidence_url.

Rules for "confidence":
- "high" when the snippet itself contains the keyword and the page is clearly the company's own page.
- "low" when you inferred it, or the page could belong to someone else.

Examples:
Input: domain=linear.app keyword=SOC 2 results=[{"title":"Security","url":"https://linear.app/security","snippet":"Linear undergoes regular Service Organization Controls audits (SOC 2 Type II)."}]
Output: {"mentions": true, "status": "has", "evidence_url": "https://linear.app/security", "line": "you run SOC 2 Type II audits", "confidence": "high"}
Input: domain=smallco.io keyword=SOC 2 results=[{"title":"Roadmap","url":"https://feedback.smallco.io/roadmap","snippet":"SOC 2 security certification - planned"}]
Output: {"mentions": true, "status": "planned", "evidence_url": "https://feedback.smallco.io/roadmap", "line": "SOC 2 is still sitting on your public roadmap", "confidence": "high"}
Input: domain=midco.com keyword=SOC 2 results=[{"title":"Trust","url":"https://trust.midco.com/","snippet":"We are in the middle of our SOC 2 Type 2 audit window."}]
Output: {"mentions": true, "status": "planned", "evidence_url": "https://trust.midco.com/", "line": "you are partway through your SOC 2 Type 2 audit", "confidence": "high"}
Input: domain=acme.com keyword=chess results=[{"title":"Best chess apps 2026","url":"https://acme.com/blog/roundup","snippet":"We ranked 20 chess apps."}]
Output: {"mentions": false, "status": "none", "evidence_url": "", "line": "", "confidence": "low"}
Input: domain=acme.com keyword=SOC 2 results=[]
Output: {"mentions": false, "status": "none", "evidence_url": "", "line": "", "confidence": "high"}

PER-ROW DATA FOLLOWS.`;

export const googleSiteSearchPlay = definePlay<Input, Output>({
  name: 'google-site-search',
  version: '1.0.0',
  description: 'Google site search with literal filter and judge prompt',
  
  inputSchema: {
    type: 'object',
    required: ['domain', 'keyword'],
    properties: {
      domain: { type: 'string' },
      keyword: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      mentions: { type: 'boolean' },
      status: { type: 'string', enum: ['has', 'planned', 'discusses', 'none'] },
      evidence_url: { type: 'string' },
      line: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { domain, keyword } = ctx.input;
    
    // Node 2: Tool - Google Custom Search with site: query
    const searchResults = await ctx.tools.findNews(
      `site:${domain} "${keyword}"`,
      { resultsLimit: 5 }
    );
    
    if (!searchResults || searchResults.length === 0) {
      return {
        data: {
          mentions: false,
          status: 'none',
          evidence_url: '',
          line: '',
          confidence: 'high'
        },
        metadata: { abstained: true, reason: 'no_results' }
      };
    }
    
    // Node 3: CODE - literal filter (keyword must appear in title+snippet)
    // Search engines do not strictly honor quoted phrases on site: queries
    const keywordLower = keyword.toLowerCase();
    const literalMatches = searchResults.filter(r => {
      const title = (r.title || '').toLowerCase();
      const snippet = (r.snippet || '').toLowerCase();
      return title.includes(keywordLower) || snippet.includes(keywordLower);
    });
    
    if (literalMatches.length === 0) {
      ctx.log('Literal filter: keyword not found in any result');
      return {
        data: {
          mentions: false,
          status: 'none',
          evidence_url: '',
          line: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'literal_filter_failed' }
      };
    }
    
    // Node 4: CODE - sanitize (remove bad hosts, fix escapes)
    const sanitized = literalMatches
      .filter(r => {
        try {
          const url = new URL(r.url);
          return !BAD_HOSTS.has(url.hostname.replace('www.', ''));
        } catch {
          return false;
        }
      })
      .map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet
      }));
    
    if (sanitized.length === 0) {
      ctx.log('Sanitize: all results from bad hosts');
      return {
        data: {
          mentions: false,
          status: 'none',
          evidence_url: '',
          line: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'all_bad_hosts' }
      };
    }
    
    // Node 5: Agent judges and writes line with LOCKED PROMPT
    const userMessage = `domain=${domain}\nkeyword=${keyword}\nresults=${JSON.stringify(sanitized)}`;
    
    const result = await ctx.tools.ai<Output>({
      systemPrompt: LOCKED_PROMPT_SITE_SEARCH,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['mentions', 'status', 'evidence_url', 'line', 'confidence'],
        properties: {
          mentions: { type: 'boolean' },
          status: { type: 'string', enum: ['has', 'planned', 'discusses', 'none'] },
          evidence_url: { type: 'string' },
          line: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 1200,
      // reasoning_effort: "minimal"
      retries: 3
    });
    
    return {
      data: result,
      metadata: {
        confidence: result.confidence,
        abstained: !result.mentions
      }
    };
  }
});

export default googleSiteSearchPlay;
