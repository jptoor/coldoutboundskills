/**
 * Name to Other Prospects Play
 * 
 * Port of: skills/playbooks/playbook-name-to-other-prospects/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain + recipient + persona titles
 * 2. Tool: colleagues-by-domain lookup
 * 3. CODE: TWO EXCLUSIONS (recipient name+URL, same-campaign list)
 * 4. Agent: JUDGE with LOCKED PROMPT (screen candidates, clean names)
 * 5. Tool: still-there web check
 * 6. CODE: assemble "Name or Name" format
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';
import { normalize } from '../../lib/utils';

interface Input {
  domain: string;
  company_name: string;
  recipient_full_name: string;
  recipient_linkedin_url: string;
  persona_titles: string[];
  all_campaign_recipients_at_this_domain?: string[];
}

interface Output {
  other_prospects: string;
  other_prospects_count: number;
  other_prospect_1_title: string;
  other_prospect_2_title: string;
}

// Support staff titles to exclude
const SUPPORT_STAFF = new Set([
  'assistant', 'executive assistant', 'administrator', 'office manager',
  'coordinator', 'receptionist', 'intern', 'apprentice', 'student',
  'product owner', 'scrum'
]);

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 105-165) - VERBATIM
// Model: reasoning model with reasoning_effort="low", 3000 tokens
// DO NOT PARAPHRASE. Graded colleague-screening prompt.
// ============================================================================
const LOCKED_PROMPT_NAME_TO_OTHER_PROSPECTS = `You screen colleague candidates for a cold email variable.

You get a target company and a list of people a data provider says work there. Pick up to 3
who are credible senior colleagues at THAT company, best first, and return their cleaned real names.

Return JSON only, exactly this shape:
{"keep":[{"name":"First Last","title":"..."}],"dropped":[{"name":"...","why":"..."}]}

Keep a person only if ALL of these are true:
- Their job title is at the target company, not a different employer.
- Their headline does not contradict the job title. A headline naming another company or a
  different line of work means the data is wrong. Drop them.
- The title is a real decision maker or senior function owner: owner, founder, chief, vice
  president, head of, director, general manager, partner, principal.
- The title is not support staff: assistant, executive assistant, administrator, office
  manager, coordinator, receptionist, intern, apprentice, student, product owner, scrum.
- The name is a real person name with a first name and a last name.

Freshness rule. Provider job titles go stale. When a candidate has no headline and no other
text tying them to the target company, prefer a candidate whose headline names the target
company. Only fall back to a no-headline candidate when there are fewer than 3 candidates
whose text names the company.

Clean the name before returning it:
- Remove credentials, emoji, pronouns, hashtags, hiring banners, quoted nicknames, and any
  text after a comma, pipe, or bracket.
- Fix ALL CAPS and all lowercase to normal capitalization. Keep accents and hyphens as they are.
- Keep the full last name. Never shorten a two word surname. Drop middle names.
- If only one name token exists, drop the person.

A headline that names a different profession from the job title is a hard drop, even when
the job title looks senior. Self reported founder titles are the most common bad data.

Order the kept people most senior first. Keep at most 3. Never invent a person. If nobody
qualifies, return an empty keep list. No em dashes anywhere in your output.

Example input:
Company: Harbor Freight Robotics (harborfreightrobotics.com)
Candidates:
1. Devon Marsh | title at company: Co-founder | headline: Wedding Photographer and Videographer
2. priya RAMANATHAN, MBA | title at company: Chief Operating Officer | headline: COO at Harbor Freight Robotics
3. Sam Whitfield | title at company: Executive Assistant to the CEO | headline: EA to the CEO
Example output:
{"keep":[{"name":"Priya Ramanathan","title":"Chief Operating Officer"}],"dropped":[{"name":"Devon Marsh","why":"headline is wedding photography, the founder title at this company is not credible"},{"name":"Sam Whitfield","why":"executive assistant is support staff, not a decision maker"}]}

Example input:
Company: Delacroix Dental Group (delacroixdental.com)
Candidates:
1. Ana Lucia Perez Ortiz | title at company: Practice Owner | headline: Owner at Delacroix Dental Group
2. T. | title at company: Director of Operations | headline:
3. Marcus Feld 🚀 | Hiring! | title at company: Head of Patient Experience | headline: Head of Patient Experience at Delacroix Dental Group
4. Robin Vale | title at company: Vice President Supply | headline:
Example output:
{"keep":[{"name":"Ana Lucia Perez Ortiz","title":"Practice Owner"},{"name":"Marcus Feld","title":"Head of Patient Experience"}],"dropped":[{"name":"T.","why":"no usable first and last name"},{"name":"Robin Vale","why":"no headline ties this person to the company and two better candidates exist"}]}

PER-ROW DATA (appended last)
Company: <company name> (<domain>)
Candidates:
<numbered candidate list>`;

export const nameToOtherProspectsPlay = definePlay<Input, Output>({
  name: 'name-to-other-prospects',
  version: '1.0.0',
  description: 'Name 2 other prospects with judge, two exclusions, and still-there check',
  
  inputSchema: {
    type: 'object',
    required: ['domain', 'company_name', 'recipient_full_name', 'recipient_linkedin_url', 'persona_titles'],
    properties: {
      domain: { type: 'string' },
      company_name: { type: 'string' },
      recipient_full_name: { type: 'string' },
      recipient_linkedin_url: { type: 'string' },
      persona_titles: { type: 'array', items: { type: 'string' } },
      all_campaign_recipients_at_this_domain: { type: 'array', items: { type: 'string' } }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      other_prospects: { type: 'string' },
      other_prospects_count: { type: 'number' },
      other_prospect_1_title: { type: 'string' },
      other_prospect_2_title: { type: 'string' }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const {
      domain,
      company_name,
      recipient_full_name,
      recipient_linkedin_url,
      persona_titles,
      all_campaign_recipients_at_this_domain = []
    } = ctx.input;
    
    // Hard requirement: recipient_full_name must be present
    if (!recipient_full_name) {
      throw new Error('recipient_full_name is required (hard exclusion to prevent naming recipient to themselves)');
    }
    
    // Node 2: Tool - colleagues-by-domain lookup
    const colleagues = await ctx.tools.searchPeople({
      company_domain: { include: [domain] },
      person_job_title: { include: persona_titles }
    });
    
    if (!colleagues || colleagues.length === 0) {
      return {
        data: {
          other_prospects: '',
          other_prospects_count: 0,
          other_prospect_1_title: '',
          other_prospect_2_title: ''
        },
        metadata: { abstained: true, reason: 'no_colleagues_found' }
      };
    }
    
    // Node 3: CODE - TWO EXCLUSIONS
    // Exclusion 1: HARD - recipient name + URL (normalize matching)
    const recipientNorm = normalize(recipient_full_name);
    const recipientUrlLower = recipient_linkedin_url.toLowerCase();
    
    const notRecipient = colleagues.filter((c: any) => {
      const candidateNorm = normalize(c.full_name || '');
      const candidateUrl = (c.linkedin_url || '').toLowerCase();
      
      // Match on normalized name OR profile URL
      if (candidateNorm === recipientNorm) return false;
      if (candidateUrl && candidateUrl === recipientUrlLower) return false;
      
      return true;
    });
    
    // Exclusion 2: SOFT - same-campaign list (when provided)
    let candidates = notRecipient;
    if (all_campaign_recipients_at_this_domain.length > 0) {
      const campaignNorms = new Set(
        all_campaign_recipients_at_this_domain.map(name => normalize(name))
      );
      
      candidates = notRecipient.filter((c: any) => {
        const candidateNorm = normalize(c.full_name || '');
        return !campaignNorms.has(candidateNorm);
      });
    }
    
    if (candidates.length === 0) {
      ctx.log('Both exclusions removed all candidates');
      return {
        data: {
          other_prospects: '',
          other_prospects_count: 0,
          other_prospect_1_title: '',
          other_prospect_2_title: ''
        },
        metadata: { abstained: true, reason: 'all_excluded' }
      };
    }
    
    // Node 4: Agent - JUDGE with LOCKED PROMPT
    const candidatesList = candidates
      .slice(0, 10) // Limit to 10 for prompt
      .map((c: any, i: number) => {
        return `${i + 1}. ${c.full_name} | title at company: ${c.title || ''} | headline: ${c.headline || ''}`;
      })
      .join('\n');
    
    const userMessage = `Company: ${company_name} (${domain})\nCandidates:\n${candidatesList}`;
    
    const aiResult = await ctx.tools.ai<{
      keep: Array<{ name: string; title: string }>;
      dropped: Array<{ name: string; why: string }>;
    }>({
      systemPrompt: LOCKED_PROMPT_NAME_TO_OTHER_PROSPECTS,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['keep', 'dropped'],
        properties: {
          keep: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                title: { type: 'string' }
              }
            }
          },
          dropped: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                why: { type: 'string' }
              }
            }
          }
        }
      },
      maxTokens: 3000,
      // reasoning_effort: "low"
      retries: 3
    });
    
    if (aiResult.keep.length === 0) {
      ctx.log('Judge: no qualifying candidates');
      return {
        data: {
          other_prospects: '',
          other_prospects_count: 0,
          other_prospect_1_title: '',
          other_prospect_2_title: ''
        },
        metadata: { abstained: true, reason: 'judge_rejected_all' }
      };
    }
    
    // Node 5: Tool - still-there web check (not optional)
    // Check if the named people are still at the company via company website
    const verified: Array<{ name: string; title: string }> = [];
    
    for (const person of aiResult.keep.slice(0, 3)) {
      try {
        // Search company website for person's name
        const searchResult = await ctx.tools.http({
          url: `https://api.example.com/website-search`,
          method: 'POST',
          body: {
            domain: domain,
            query: person.name
          }
        });
        
        if (searchResult.found) {
          verified.push(person);
        } else {
          ctx.log(`Still-there check failed for ${person.name}`);
        }
      } catch (e) {
        // If check fails, be conservative and exclude
        ctx.log(`Still-there check error for ${person.name}`);
      }
      
      if (verified.length >= 2) break; // We only need 2 max
    }
    
    if (verified.length === 0) {
      ctx.log('Still-there check: no one verified');
      return {
        data: {
          other_prospects: '',
          other_prospects_count: 0,
          other_prospect_1_title: '',
          other_prospect_2_title: ''
        },
        metadata: { abstained: true, reason: 'still_there_check_failed' }
      };
    }
    
    // Node 6: CODE - assemble "Name or Name" format
    const names = verified.slice(0, 2).map(p => p.name);
    const otherProspects = names.join(' or ');
    
    return {
      data: {
        other_prospects: otherProspects,
        other_prospects_count: names.length,
        other_prospect_1_title: verified[0]?.title || '',
        other_prospect_2_title: verified[1]?.title || ''
      },
      metadata: {
        confidence: 'high',
        abstained: false
      }
    };
  }
});

export default nameToOtherProspectsPlay;
