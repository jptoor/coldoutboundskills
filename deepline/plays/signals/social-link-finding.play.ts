/**
 * Social Link Finding Play
 * 
 * Port of: skills/playbooks/playbook-social-link-finding/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: person (name, email, linkedin) + company domain
 * 2. Tool: social-link-search (with ownership verifier)
 * 3. CODE: deduplication + quality filter
 * 4. Agent: OWNERSHIP VERIFIER with LOCKED PROMPT
 * 5. CODE: final pick (first verified match)
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  person_name: string;
  person_email: string;
  person_linkedin: string;
  company_domain: string;
}

interface Output {
  twitter_url: string;
  confidence: 'high' | 'low';
}

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 140-170) - VERBATIM
// Model: nano-class reasoning model with reasoning_effort="minimal"
// OWNERSHIP VERIFIER PROMPT
// DO NOT PARAPHRASE. Graded prompt.
// ============================================================================
const LOCKED_PROMPT_OWNERSHIP_VERIFIER = `You verify whether a candidate social media URL belongs to a specific company.

You are given the company name, the company website domain, the social platform, the candidate profile URL, and the evidence that produced it.

Return JSON only, exactly these keys:
{"owned":true|false,"canonical_url":"...","confidence":"high|low","reason":"..."}

Rules:
- "owned" is true only when the profile is the official account of THAT company. An account belonging to a different company with a similar name is false. An unrelated account that merely mentions the company is false. A fan page, a reseller, a news account, a hashtag or discovery page, or an individual employee's personal profile is false.
- Evidence sourced from the company's own website HTML is strong. Treat it as owned unless the handle clearly belongs to a different brand.
- Evidence sourced from a search engine is weak. Require the profile title, the handle, or the URL slug to match the company name or its domain root before returning true.
- A profile title naming a different entity than the company is false, even when the handle looks right.
- A URL that is a post, a photo page, a jobs page, a discovery page, an aggregator page, or a search page is not a profile. Return false. This includes tiktok.com/discover/..., instagram.com/p/..., instagram.com/popular/..., and youtube.com/playlist?...
- A YouTube URL of the form youtube.com/channel/UC... carries an opaque channel id that can never contain the company name. Judge it on the result title alone: when the title is the company name, owned is true and confidence is high.
- canonical_url: strip country subdomains to www, strip query strings, strip trailing path segments after the profile handle, strip the trailing slash. If owned is false, return "".
- confidence is "high" when the handle or slug contains the company name or the domain root, or the evidence came from the company website, or the profile title is exactly the company name.
- Never invent a URL that was not in the input.

PER-ROW DATA (appended last)
Company: <company name>
Domain: <domain>
Platform: <platform>
Candidate URL: <candidate>
Evidence: <evidence source and snippet>
`;

export const socialLinkFindingPlay = definePlay<Input, Output>({
  name: 'social-link-finding',
  version: '1.0.0',
  description: 'Social link finding with ownership verifier and locked prompt',
  
  inputSchema: {
    type: 'object',
    required: ['person_name', 'person_email', 'person_linkedin', 'company_domain'],
    properties: {
      person_name: { type: 'string' },
      person_email: { type: 'string' },
      person_linkedin: { type: 'string' },
      company_domain: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      twitter_url: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { person_name, person_email, person_linkedin, company_domain } = ctx.input;
    
    // Node 2: Tool - social-link-search
    const candidates = await ctx.tools.http({
      url: 'https://api.example.com/social-search',
      method: 'POST',
      body: {
        name: person_name,
        email: person_email,
        linkedin: person_linkedin,
        platforms: ['twitter']
      }
    });
    
    const accounts = candidates.data || [];
    
    if (accounts.length === 0) {
      return {
        data: {
          twitter_url: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'no_candidates' }
      };
    }
    
    // Node 3: CODE - deduplication + quality filter
    const seen = new Set<string>();
    const deduped = accounts.filter((a: any) => {
      const handle = (a.handle || '').toLowerCase();
      if (seen.has(handle) || !handle) return false;
      seen.add(handle);
      return true;
    });
    
    // Quality filter: must have display_name or bio
    const quality = deduped.filter((a: any) => a.display_name || a.bio);
    
    if (quality.length === 0) {
      return {
        data: {
          twitter_url: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'no_quality_candidates' }
      };
    }
    
    // Node 4: Agent - OWNERSHIP VERIFIER with LOCKED PROMPT
    const emailDomain = person_email.split('@').pop() || company_domain;
    
    for (const account of quality) {
      const userMessage = `person_name=${person_name} email_domain=${emailDomain} linkedin=${person_linkedin} | candidate account: handle=${account.handle} display_name=${account.display_name || ''} bio=${account.bio || ''}`;
      
      const aiResult = await ctx.tools.ai<{
        verified: boolean;
        reason: string;
      }>({
        systemPrompt: LOCKED_PROMPT_OWNERSHIP_VERIFIER,
        userPrompt: userMessage,
        jsonMode: true,
        jsonSchema: {
          type: 'object',
          required: ['verified', 'reason'],
          properties: {
            verified: { type: 'boolean' },
            reason: { type: 'string' }
          }
        },
        maxTokens: 800,
        // reasoning_effort: "minimal"
        retries: 3
      });
      
      // Node 5: CODE - final pick (first verified match)
      if (aiResult.verified) {
        return {
          data: {
            twitter_url: `https://twitter.com/${account.handle}`,
            confidence: 'high'
          },
          metadata: {
            confidence: 'high',
            abstained: false
          }
        };
      }
    }
    
    // No verified matches
    return {
      data: {
        twitter_url: '',
        confidence: 'low'
      },
      metadata: { abstained: true, reason: 'no_verified_match' }
    };
  }
});

export default socialLinkFindingPlay;
