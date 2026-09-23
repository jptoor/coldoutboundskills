/**
 * Deepline port of playbook-new-in-role
 *
 * Original: skills/playbooks/playbook-new-in-role/SKILL.md
 * Output: new_in_role_line, role_change_type, role_start_month, months_in_role, prior_title
 *
 * Source chain: Prospeo /search-person with person_time_in_current_role filter → model line writer
 * Coverage: 9/10 usable (90%) | 0 false positives on tenure
 * Cost: ~$0.05 per 1,000 rows
 *
 * Locked prompt preserved verbatim from SKILL.md (graded on gpt-5-nano reasoning_effort=minimal).
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';
import type { DeeplinePlayRuntimeContext } from 'deepline';

type NewInRoleRow = {
  first_name: string;
  current_title: string;
  company_name: string;
  company_domain: string;
  new_in_role_line: string;
  role_change_type: 'promotion' | 'new_hire';
  role_start_month: string;
  months_in_role: number;
  prior_title: string;
  prior_company: string;
};

function monthsSince(isoDate: string): number {
  if (!isoDate) return 9999;
  const date = new Date(isoDate);
  const now = new Date();
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  return months;
}

function formatMonthYear(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function cleanCompanyName(name: string): string {
  // Strip legal suffixes and parentheticals per SKILL.md prompt
  let clean = name;
  // Remove anything in parentheses
  clean = clean.replace(/\s*\([^)]*\)/g, '');
  // Remove legal suffixes
  const suffixes = [', LLC', ', Inc', ', PLC', ', Ltd', ' LLC', ' Inc', ' PLC', ' Ltd'];
  for (const suffix of suffixes) {
    if (clean.endsWith(suffix)) {
      clean = clean.slice(0, -suffix.length);
    }
  }
  return clean.trim();
}

async function generateNewInRoleLine(
  ctx: DeeplinePlayRuntimeContext,
  facts: {
    first_name: string;
    current_title: string;
    company_name: string;
    role_start_month: string;
    months_in_role: number;
    role_change_type: string;
    prior_title: string;
    prior_company: string;
  }
): Promise<{
  new_in_role_line: string;
  role_change_type: string;
  confidence: string;
}> {
  const prompt = `You write one short opening clause for a cold email, about a person who recently changed jobs.

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
Facts: first_name=${facts.first_name} | current_title=${facts.current_title} | company_name=${facts.company_name} | role_start_month=${facts.role_start_month} | months_in_role=${facts.months_in_role} | role_change_type=${facts.role_change_type} | prior_title=${facts.prior_title} | prior_company=${facts.prior_company}`;

  try {
    const result = await ctx.tools.execute({
      id: 'new_in_role_line_writer',
      tool: 'deeplineagent',
      input: {
        prompt,
        jsonSchema: {
          type: 'object',
          properties: {
            new_in_role_line: { type: 'string' },
            role_change_type: { type: 'string', enum: ['promotion', 'new_hire'] },
            confidence: { type: 'string', enum: ['high', 'low'] },
          },
          required: ['new_in_role_line', 'role_change_type', 'confidence'],
        },
        // From SKILL.md: small reasoning model, minimal reasoning effort
        maxCompletionTokens: 2000,
        // TODO: Add reasoning_effort=minimal when Deepline supports it
      },
      description: 'Generate new-in-role copy-ready clause',
    });

    // Truncation guard: retry on finish_reason=length (fired on 10/10 rows at default reasoning)
    const finishReason = result.toolResponse?.raw?.choices?.[0]?.finish_reason;
    if (finishReason === 'length') {
      throw new Error('TRUNCATION_RETRY');
    }

    return (
      result.data || { new_in_role_line: '', role_change_type: 'new_hire', confidence: 'low' }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'TRUNCATION_RETRY') {
      throw error;
    }
    return { new_in_role_line: '', role_change_type: 'new_hire', confidence: 'low' };
  }
}

export default definePlay(
  'new-in-role',
  async (
    ctx: DeeplinePlayRuntimeContext,
    input: {
      csv?: string;
      job_titles: string[];
      locations?: string[];
      headcount_min?: number;
      headcount_max?: number;
      recency_months?: number; // Default: 3 (90 days)
    }
  ): Promise<{ rows: unknown }> => {
    const recencyMonths = input.recency_months || 3; // Default: 90 days = 3 months

    let rows: any;

    if (input.csv) {
      // Load existing CSV with person data
      rows = await ctx.csv(input.csv).run();
    } else {
      // Search for new-in-role people (filter-at-source)
      // TODO: Replace with actual Deepline person search tool
      // Expected: prospeo_search_person or similar with person_time_in_current_role filter

      // For now, this is a STUB showing the search contract
      const searchResults = await ctx.tools.execute({
        id: 'new_in_role_search',
        tool: 'prospeo_search_person', // or leadmagic_profile_search
        input: {
          person_job_title: { include: input.job_titles },
          person_location_search: { include: input.locations || ['United States #US'] },
          company_headcount_custom: {
            min: input.headcount_min || 50,
            max: input.headcount_max || 2000,
          },
          person_time_in_current_role: { min: 0, max: recencyMonths },
        },
        description: `Search for people new in role within ${recencyMonths} months`,
      });

      rows = await ctx.dataset('new_in_role_people', searchResults.data.results || []).run({
        key: (_row: any, index: number) => `new_in_role_${index}`,
      });
    }

    // Enrich with new-in-role signal
    const enriched = await rows
      .withColumn('new_in_role_line', async (row: any) => '')
      .withColumn('role_change_type', async (row: any) => 'new_hire')
      .withColumn('role_start_month', async (row: any) => '')
      .withColumn('months_in_role', async (row: any) => 0)
      .withColumn('prior_title', async (row: any) => '')
      .withColumn('prior_company', async (row: any) => '')
      .withColumn('_new_in_role_enriched', async (row: any) => {
        // Guard: require job_history with current role
        if (!row.job_history || !Array.isArray(row.job_history) || row.job_history.length === 0) {
          return {
            new_in_role_line: '',
            role_change_type: 'new_hire',
            role_start_month: '',
            months_in_role: 0,
            prior_title: '',
            prior_company: '',
          };
        }

        // Parse job history (assuming job_history[0] is current role)
        const currentJob = row.job_history[0];
        const priorJob = row.job_history.length > 1 ? row.job_history[1] : null;

        const currentTitle = currentJob.title || '';
        const currentCompany = currentJob.company_name || row.company_name || '';
        const startDate = currentJob.start_date || '';

        if (!currentTitle || !currentCompany || !startDate) {
          // Missing required facts → abstain
          return {
            new_in_role_line: '',
            role_change_type: 'new_hire',
            role_start_month: '',
            months_in_role: 0,
            prior_title: '',
            prior_company: '',
          };
        }

        // Title gate: filter loose matches (per SKILL.md §7)
        // The search returns people whose title CONTAINS the keyword, which can match a PAST role
        // Drop rows where current title doesn't contain any of the search keywords
        const titleLower = currentTitle.toLowerCase();
        const matchesKeyword = input.job_titles.some((keyword) =>
          titleLower.includes(keyword.toLowerCase())
        );

        if (!matchesKeyword) {
          // Title gate failed → abstain
          return {
            new_in_role_line: '',
            role_change_type: 'new_hire',
            role_start_month: '',
            months_in_role: 0,
            prior_title: '',
            prior_company: '',
          };
        }

        // Compute deterministic fields
        const monthsInRole = monthsSince(startDate);
        const roleStartMonth = formatMonthYear(startDate);
        const priorTitle = priorJob?.title || '';
        const priorCompany = priorJob?.company_name || '';

        // Determine role_change_type (deterministic, never trust model)
        const isSameCompany =
          priorCompany &&
          currentCompany &&
          priorCompany.toLowerCase().trim() === currentCompany.toLowerCase().trim();
        const roleChangeType = isSameCompany ? 'promotion' : 'new_hire';

        // Build facts record for model
        const facts = {
          first_name: row.first_name || '',
          current_title: currentTitle,
          company_name: cleanCompanyName(currentCompany),
          role_start_month: roleStartMonth,
          months_in_role: monthsInRole,
          role_change_type: roleChangeType,
          prior_title: priorTitle,
          prior_company: priorCompany,
        };

        // Generate line
        const result = await generateNewInRoleLine(ctx, facts);

        // Model's role_change_type is DISCARDED (per SKILL.md §6)
        // The deterministic value computed above is the real one
        return {
          new_in_role_line: result.new_in_role_line || '',
          role_change_type: roleChangeType,
          role_start_month: roleStartMonth,
          months_in_role: monthsInRole,
          prior_title: priorTitle,
          prior_company: priorCompany,
        };
      })
      .withColumn('new_in_role_line', async (row: any) => row._new_in_role_enriched?.new_in_role_line || '')
      .withColumn('role_change_type', async (row: any) => row._new_in_role_enriched?.role_change_type || 'new_hire')
      .withColumn('role_start_month', async (row: any) => row._new_in_role_enriched?.role_start_month || '')
      .withColumn('months_in_role', async (row: any) => row._new_in_role_enriched?.months_in_role || 0)
      .withColumn('prior_title', async (row: any) => row._new_in_role_enriched?.prior_title || '')
      .withColumn('prior_company', async (row: any) => row._new_in_role_enriched?.prior_company || '')
      .run({
        key: (row: any) => row.email || row.linkedin_url || String(Math.random()),
      });

    return { rows: enriched };
  },
  {
    description:
      'Produces a copy-ready clause about someone who recently started or changed into their current job title. Filter-at-source signal. Output: new_in_role_line = "you stepped into the COO seat at Northwind in April". Coverage: 90% usable (9/10). Abstain = empty string.',
    billing: { maxCreditsPerRun: 100 },
  }
);
