/**
 * New in Role Play
 * 
 * Port of: skills/playbooks/playbook-new-in-role/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: titles, location, headcount, time window
 * 2. Tool: people search with person_time_in_current_role filter
 * 3. CODE: Title gate (must include abbreviations)
 * 4. CODE: Deterministic fields (role_change_type, months, month label)
 * 5. Agent: write the line
 * 6. CODE: QC + output contract
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  titles: string[];
  location: string;
  headcount_min: number;
  headcount_max: number;
  months_max?: number; // Default 3, ceiling 9
}

interface Output {
  new_in_role_line: string;
  role_change_type: 'promotion' | 'new_hire' | '';
  role_start_month: string;
  months_in_role: number;
  prior_title: string;
}

// Month names for date formatting
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 250-282) - VERBATIM, graded at 9/10
// Model: gpt-5-nano with reasoning_effort="minimal"
// DO NOT PARAPHRASE. Model was graded on this exact text.
// ============================================================================
const LOCKED_PROMPT_NEW_IN_ROLE = `You write one short opening clause for a cold email, about a person who recently changed jobs.

You will be given verified facts about one person. The facts are already true. Your only job is to turn them into one natural clause.

Return JSON only, exactly these keys:
{"new_in_role_line": "...", "role_change_type": "promotion|new_hire", "confidence": "high|low"}

Rules for new_in_role_line:
- It must read correctly inside this sentence: "Saw <new_in_role_line>."
- Start with a lowercase letter. No period at the end. No quotation marks.
- Maximum 90 characters.
- Say the seat and the company and roughly when. Use the month name given, or say "earlier this year" if the month is more than 4 months ago.
- Only say "earlier this year" if the start year given is the CURRENT year. If the start year is any earlier year, say the month and the year, for example "in September 2026". Never say "earlier this year" about a date in a previous year.
- If role_change_type is promotion, say they stepped into or took over the seat. Do not say they joined the company. Never say "moved up", "got promoted", or "was promoted": an internal move is not always a step up and we cannot prove it was.
- If role_change_type is new_hire, you may say they joined.
- Use the shortest natural form of the company name. Drop anything inside parentheses, drop legal suffixes like LLC, Inc, PLC, Ltd, and drop trailing descriptive phrases after a comma. "ATG (Auction Technology Group)" becomes "ATG". "A.Y. Strauss, LLC" becomes "A.Y. Strauss".
- 5th-grade reading level. Short words.
- No em dashes. No en dashes. Hyphens are fine only inside a number range.
- Never invent a fact. Only use the facts given. Do not mention headcount, industry, funding, or anything not in the facts.
- If the facts are missing the title, the company, or the start month, return "" for new_in_role_line and "low" for confidence.

Examples:
Facts: first_name=Dana | current_title=VP of Operations | company_name=Gymshark | role_start_month=March 2026 | months_in_role=3 | role_change_type=new_hire | prior_title=Director of Supply Chain | prior_company=Represent
Output: {"new_in_role_line": "you joined Gymshark as VP of Operations back in March", "role_change_type": "new_hire", "confidence": "high"}
Facts: first_name=Marcus | current_title=Chief Operating Officer | company_name=Irby Utilities, LLC | role_start_month=February 2026 | months_in_role=6 | role_change_type=promotion | prior_title=Senior Vice President | prior_company=Irby Utilities, LLC
Output: {"new_in_role_line": "you stepped into the COO seat at Irby earlier this year", "role_change_type": "promotion", "confidence": "high"}
Facts: first_name=Priya | current_title= | company_name=Northwind Labs | role_start_month= | months_in_role= | role_change_type=new_hire | prior_title= | prior_company=
Output: {"new_in_role_line": "", "role_change_type": "new_hire", "confidence": "low"}

PER-ROW DATA (appended last, as the user message, never merged into the block above)
Facts: first_name={{First Name}} | current_title={{Current Title (from job_history)}} | company_name={{Company Name Clean}} | role_start_month={{Role Start Month Label}} | months_in_role={{Months In Role}} | role_change_type={{Role Change Type}} | prior_title={{Prior Title}} | prior_company={{Prior Company}}`;

export const newInRolePlay = definePlay<Input, Output>({
  name: 'new-in-role',
  version: '1.0.0',
  description: 'New in role signal with 100-line locked prompt and deterministic fields',
  
  inputSchema: {
    type: 'object',
    required: ['titles', 'location', 'headcount_min', 'headcount_max'],
    properties: {
      titles: { type: 'array', items: { type: 'string' } },
      location: { type: 'string' },
      headcount_min: { type: 'number' },
      headcount_max: { type: 'number' },
      months_max: { type: 'number', default: 3 }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      new_in_role_line: { type: 'string' },
      role_change_type: { type: 'string', enum: ['promotion', 'new_hire', ''] },
      role_start_month: { type: 'string' },
      months_in_role: { type: 'number' },
      prior_title: { type: 'string' }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { titles, location, headcount_min, headcount_max, months_max = 3 } = ctx.input;
    
    // Node 2: Tool - people search with person_time_in_current_role filter
    const people = await ctx.tools.searchPeople({
      person_job_title: { include: titles },
      person_location_search: { include: [location] },
      company_headcount_custom: { min: headcount_min, max: headcount_max },
      person_time_in_current_role: { min: 0, max: months_max }
    });
    
    if (!people || people.length === 0) {
      return {
        data: {
          new_in_role_line: '',
          role_change_type: '',
          role_start_month: '',
          months_in_role: 0,
          prior_title: ''
        },
        metadata: { abstained: true, reason: 'no_people_found' }
      };
    }
    
    const person = people[0]; // Take first result
    
    // Node 3: CODE - Title gate (must include abbreviations like "COO" for "Chief Operating Officer")
    const currentTitle = person.job_history?.[0]?.title || '';
    const titleLower = currentTitle.toLowerCase();
    const gateList = titles.map(t => t.toLowerCase());
    
    // Gate: current title must contain one of the searched titles
    const titleMatch = gateList.some(t => titleLower.includes(t));
    if (!titleMatch) {
      ctx.log(`Title gate failed: "${currentTitle}" not in ${titles.join(', ')}`);
      return {
        data: {
          new_in_role_line: '',
          role_change_type: '',
          role_start_month: '',
          months_in_role: 0,
          prior_title: ''
        },
        metadata: { abstained: true, reason: 'title_gate_failed' }
      };
    }
    
    // Node 4: CODE - Deterministic fields (role_change_type, months, month label)
    const jobHistory = person.job_history || [];
    const current = jobHistory[0];
    const prior = jobHistory[1];
    
    const currentCompany = current?.company_name || '';
    const priorCompany = prior?.company_name || '';
    const roleChangeType = currentCompany === priorCompany ? 'promotion' : 'new_hire';
    
    // Calculate months_in_role
    const startDate = new Date(current?.start_date || Date.now());
    const now = new Date();
    const monthsInRole = (now.getFullYear() - startDate.getFullYear()) * 12 + 
                        (now.getMonth() - startDate.getMonth());
    
    // Format role_start_month as "Month YYYY"
    const monthName = MONTHS[startDate.getMonth()];
    const year = startDate.getFullYear();
    const roleStartMonth = `${monthName} ${year}`;
    
    // Node 5: Agent writes the line with LOCKED PROMPT
    const facts = {
      first_name: person.first_name || '',
      current_title: currentTitle,
      company_name: currentCompany,
      role_start_month: roleStartMonth,
      months_in_role: monthsInRole,
      role_change_type: roleChangeType,
      prior_title: prior?.title || '',
      prior_company: priorCompany
    };
    
    const userMessage = Object.entries(facts)
      .map(([k, v]) => `${k}=${v}`)
      .join(' | ');
    
    const aiResult = await ctx.tools.ai<{
      new_in_role_line: string;
      role_change_type: 'promotion' | 'new_hire';
      confidence: 'high' | 'low';
    }>({
      systemPrompt: LOCKED_PROMPT_NEW_IN_ROLE,
      userPrompt: `Facts: ${userMessage}`,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['new_in_role_line', 'role_change_type', 'confidence'],
        properties: {
          new_in_role_line: { type: 'string' },
          role_change_type: { type: 'string', enum: ['promotion', 'new_hire'] },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 2000, // max_completion_tokens for nano
      // reasoning_effort: "minimal"
      retries: 3
    });
    
    // Node 6: QC + output contract
    return {
      data: {
        new_in_role_line: aiResult.new_in_role_line,
        role_change_type: roleChangeType, // Use deterministic value, not model's
        role_start_month: roleStartMonth,
        months_in_role: monthsInRole,
        prior_title: facts.prior_title
      },
      metadata: {
        confidence: aiResult.confidence,
        abstained: !aiResult.new_in_role_line
      }
    };
  }
});

export default newInRolePlay;
