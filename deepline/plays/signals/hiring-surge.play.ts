/**
 * Hiring Surge Play
 * 
 * Port of: skills/playbooks/playbook-hiring-surge/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain
 * 2. Company → LinkedIn URL
 * 3. Employee count by criteria (current vs 6mo ago)
 * 4. CODE: sanity guard + banned claims
 * 5. CODE: ratio + floors gate
 * 6. Agent: write the clause
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  domain: string;
  department: 'sales' | 'marketing'; // job_functions enum
}

interface Output {
  hiring_surge_line: string;
  hiring_surge_dept: string;
  hiring_surge_hires: number;
  confidence: 'high' | 'low';
}

// Banned hire claims from clay-workflow.md
const BANNED_HIRE_CLAIMS = new Set([
  'hired', 'added', 'brought on', 'recruited', 'grew by', 'onboarded'
]);

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 270-300) - VERBATIM, graded at 10/10
// Model: gpt-4o-mini inside Clay, gpt-5-nano with reasoning_effort="minimal" outside Clay
// DO NOT PARAPHRASE. Model was graded on this exact text.
// ============================================================================
const LOCKED_PROMPT_HIRING_SURGE = `STATIC PREFIX (byte-identical across calls, keep first)

You write one short clause for a cold email. The clause tells a company that we noticed people on one of their teams recently started new roles.

You are given a department name and how many people on that team started their current role in the last 6 months. The number is already verified. Your only job is wording.

IMPORTANT: the number counts people who STARTED A NEW ROLE. Some of them were hired from outside and some were promoted or moved internally. You cannot tell which. So never say the company hired, added, brought on, recruited, or grew by those people. Say that those people started new roles, or are new in their roles, or joined that team.

Return JSON only, no prose, no code fence:
{"hiring_surge_line": "...", "confidence": "high|low"}

Rules:
- The clause must read correctly inside this sentence: "Noticed <hiring_surge_line>."
- Write it in second person, about "you" or "your team". Never write the company name.
- Start with a lowercase letter. No trailing period. No em dashes. 5th grade reading level.
- Use the exact number you are given. Never invent a number, a job title, a person, or a date.
- Say "in the last six months" or "over the past six months". Never a specific month or date.
- Never claim the company hired anyone. Say people started new roles.
- Keep it under 90 characters.
- confidence is "high" when the number is 3 or more, otherwise "low".

Examples:
Input: {"department":"sales","role_starts_last_6_months":8}
Output: {"hiring_surge_line":"your sales team has 8 people who started new roles in the last six months","confidence":"high"}
Input: {"department":"marketing","role_starts_last_6_months":3}
Output: {"hiring_surge_line":"on your marketing team, 3 people started new roles in the past six months","confidence":"high"}
Input: {"department":"sales","role_starts_last_6_months":2}
Output: {"hiring_surge_line":"you have 2 people on the sales team who started new roles in the last six months","confidence":"low"}

PER-ROW DATA (appended last)
{"department":"{{Hiring Surge Dept}}","role_starts_last_6_months":{{Hiring Surge Hires}}}`;

export const hiringSurgePlay = definePlay<Input, Output>({
  name: 'hiring-surge',
  version: '1.0.0',
  description: 'Hiring surge signal with ratio + floors gate and locked prompt',
  
  inputSchema: {
    type: 'object',
    required: ['domain', 'department'],
    properties: {
      domain: { type: 'string' },
      department: { type: 'string', enum: ['sales', 'marketing'] }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      hiring_surge_line: { type: 'string' },
      hiring_surge_dept: { type: 'string' },
      hiring_surge_hires: { type: 'number' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { domain, department } = ctx.input;
    
    // Node 2: Company → LinkedIn URL (tool stub)
    const companyData = await ctx.tools.enrichCompany(domain);
    const linkedinUrl = companyData.linkedin_url;
    
    if (!linkedinUrl) {
      ctx.log('No LinkedIn URL found');
      return {
        data: {
          hiring_surge_line: '',
          hiring_surge_dept: department,
          hiring_surge_hires: 0,
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'no_linkedin_url' }
      };
    }
    
    // Node 3: Employee count by criteria (current vs 6 months ago)
    // Tool stub - this is a metered Clay action, not available in workflows
    // Returns: current_count, six_months_ago_count
    const jobFunction = department === 'sales' ? 'Sales' : 'Marketing and Public Relations';
    
    const currentCount = await ctx.tools.searchPeople({
      company_linkedin_url: linkedinUrl,
      job_functions: [jobFunction]
    });
    
    const sixMonthsAgoCount = await ctx.tools.searchPeople({
      company_linkedin_url: linkedinUrl,
      job_functions: [jobFunction],
      person_time_in_current_role: { min: 6, max: 600 }
    });
    
    const totalNow = currentCount.length;
    const totalThen = sixMonthsAgoCount.length;
    const recentStarts = totalNow - totalThen;
    
    // Node 4: CODE - Sanity guard (department count vs known total headcount)
    // From SKILL.md §7: abstain when department count exceeds company total
    if (companyData.headcount && totalNow > companyData.headcount) {
      ctx.log(`Sanity check failed: ${department} count ${totalNow} > company total ${companyData.headcount}`);
      return {
        data: {
          hiring_surge_line: '',
          hiring_surge_dept: department,
          hiring_surge_hires: 0,
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'sanity_check_failed' }
      };
    }
    
    // Node 5: CODE - Ratio + floors gate (from clay-workflow.md)
    // hires >= 2 && total >= 4 && (hires / (total - hires)) >= 0.15
    const eligible = recentStarts >= 2 && 
                    totalNow >= 4 && 
                    (recentStarts / (totalNow - recentStarts)) >= 0.15;
    
    // Override: roleCount > 6 (absolute) - from clay-workflow.md
    const absoluteOverride = recentStarts > 6;
    
    if (!eligible && !absoluteOverride) {
      ctx.log(`Gate failed: recent=${recentStarts}, total=${totalNow}, ratio=${recentStarts/(totalNow-recentStarts)}`);
      return {
        data: {
          hiring_surge_line: '',
          hiring_surge_dept: department,
          hiring_surge_hires: recentStarts,
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'below_threshold' }
      };
    }
    
    // Node 6: Agent writes the clause with LOCKED PROMPT
    const userMessage = JSON.stringify({
      department,
      role_starts_last_6_months: recentStarts
    });
    
    const aiResult = await ctx.tools.ai<{
      hiring_surge_line: string;
      confidence: 'high' | 'low';
    }>({
      systemPrompt: LOCKED_PROMPT_HIRING_SURGE,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['hiring_surge_line', 'confidence'],
        properties: {
          hiring_surge_line: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 1200, // max_completion_tokens for nano with minimal effort
      retries: 3
    });
    
    // Banned hire claims check (from clay-workflow.md)
    const lineLower = aiResult.hiring_surge_line.toLowerCase();
    for (const banned of BANNED_HIRE_CLAIMS) {
      if (lineLower.includes(banned)) {
        ctx.log(`Banned hire claim detected: ${banned}`);
        return {
          data: {
            hiring_surge_line: '',
            hiring_surge_dept: department,
            hiring_surge_hires: recentStarts,
            confidence: 'low'
          },
          metadata: { abstained: true, reason: 'banned_hire_claim' }
        };
      }
    }
    
    return {
      data: {
        hiring_surge_line: aiResult.hiring_surge_line,
        hiring_surge_dept: department,
        hiring_surge_hires: recentStarts,
        confidence: aiResult.confidence
      },
      metadata: {
        confidence: aiResult.confidence,
        abstained: !aiResult.hiring_surge_line
      }
    };
  }
});

export default hiringSurgePlay;
