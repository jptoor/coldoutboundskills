/**
 * Job Posting Language Play
 * 
 * Port of: skills/playbooks/playbook-job-posting-language/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain + keyword
 * 2. Tool: LinkedIn jobs search (server-side filtered by description)
 * 3. CODE: name-match gate (company name vs returned name)
 * 4. Agent: write the line
 * 5. CODE: freshness gate (30-day claim on 60-day detect)
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  domain: string;
  company_name: string;
  keyword: string;
}

interface Output {
  job_posting_line: string;
  role_named: string;
  evidence_url: string;
  confidence: 'high' | 'low';
}

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 250-280) - VERBATIM
// Model: gpt-4o-mini inside Clay, gpt-5-nano with reasoning_effort="low" outside
// DO NOT PARAPHRASE. Graded prompt.
// ============================================================================
const LOCKED_PROMPT_JOB_POSTING = `STATIC PREFIX (byte-identical across calls, keep first)

You write one short clause for a cold email. You are given open job postings that a company published on LinkedIn in the last 60 days. Every posting shown already matched the client's keyword filter, so the hiring signal is real. Your only job is to name the role in plain words.

Return JSON only, exactly these keys:
{"job_posting_line": "...", "role_named": "...", "evidence_url": "...", "confidence": "high|low"}

Rules for job_posting_line:
- It must read correctly inside this sentence: "Saw <job_posting_line>."
- Start with "you" and a lowercase letter. No capital letter at the start. No period at the end.
- Name one role only. If several postings are shown, pick the most senior sales or outbound role, otherwise the first one.
- Rewrite the raw job title into words a person would say out loud. Drop pipes, dashes, requisition codes, bracketed tags, city names, and words like REFER.
- 5th-grade reading level. 12 words or fewer.
- No em dashes. No en dashes. Hyphens are fine inside a normal word.
- Never invent a role that is not in the postings shown.
- If no posting is shown, return "" for job_posting_line and "low" for confidence.

Set role_named to the cleaned role words only. Set evidence_url to the LinkedIn URL of the posting you used. Set confidence to "high" when one posting clearly names a role, "low" when the titles are vague or conflicting.

Examples:
Input: Company: Gong | Postings: [{"title":"Mid Market Account Executive, Financial Services","url":"https://www.linkedin.com/jobs/view/x1"}]
Output: {"job_posting_line": "you're hiring a mid market account executive", "role_named": "mid market account executive", "evidence_url": "https://www.linkedin.com/jobs/view/x1", "confidence": "high"}
Input: Company: Ramp | Postings: [{"title":"Sales Enablement | SDR","url":"https://www.linkedin.com/jobs/view/x2"}]
Output: {"job_posting_line": "you're bringing on a new sales development rep", "role_named": "sales development rep", "evidence_url": "https://www.linkedin.com/jobs/view/x2", "confidence": "high"}
Input: Company: Acme | Postings: []
Output: {"job_posting_line": "", "role_named": "", "evidence_url": "", "confidence": "low"}

PER-ROW DATA (appended last)
Company: <company domain> | Postings: <deduped postings JSON>`;

export const jobPostingLanguagePlay = definePlay<Input, Output>({
  name: 'job-posting-language',
  version: '1.0.0',
  description: 'Job posting language with name-match gate and freshness gate',
  
  inputSchema: {
    type: 'object',
    required: ['domain', 'company_name', 'keyword'],
    properties: {
      domain: { type: 'string' },
      company_name: { type: 'string' },
      keyword: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      job_posting_line: { type: 'string' },
      role_named: { type: 'string' },
      evidence_url: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { domain, company_name, keyword } = ctx.input;
    
    // Node 2: Tool - LinkedIn jobs search (server-side filtered by description)
    // IMPORTANT: Filter by description on the server, not scan returned fields
    const jobPostings = await ctx.tools.http({
      url: 'https://api.example.com/linkedin-jobs',
      method: 'POST',
      body: {
        company: domain,
        description_keywords: [keyword],
        date_posted_days: 60 // Detect on 60 days
      }
    });
    
    const postings = jobPostings.data || [];
    
    if (postings.length === 0) {
      return {
        data: {
          job_posting_line: '',
          role_named: '',
          evidence_url: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'no_postings' }
      };
    }
    
    // Node 3: CODE - name-match gate (company name vs returned company name)
    // Required when job came from domain→profile resolution
    const returnedCompany = postings[0].company_name || '';
    const nameLower = company_name.toLowerCase();
    const returnedLower = returnedCompany.toLowerCase();
    
    if (!returnedLower.includes(nameLower) && !nameLower.includes(returnedLower)) {
      ctx.log(`Name mismatch: "${company_name}" vs "${returnedCompany}"`);
      return {
        data: {
          job_posting_line: '',
          role_named: '',
          evidence_url: '',
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'name_mismatch' }
      };
    }
    
    // Dedupe postings by title
    const seen = new Set<string>();
    const deduped = postings.filter((p: any) => {
      if (seen.has(p.title)) return false;
      seen.add(p.title);
      return true;
    });
    
    // Node 4: Agent writes the line with LOCKED PROMPT
    const userMessage = `Company: ${domain} | Postings: ${JSON.stringify(deduped.map((p: any) => ({
      title: p.title,
      url: p.url
    })))}`;
    
    const aiResult = await ctx.tools.ai<Output>({
      systemPrompt: LOCKED_PROMPT_JOB_POSTING,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['job_posting_line', 'role_named', 'evidence_url', 'confidence'],
        properties: {
          job_posting_line: { type: 'string' },
          role_named: { type: 'string' },
          evidence_url: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 2500, // For nano with reasoning_effort="low"
      retries: 3
    });
    
    // Node 5: CODE - freshness gate (30-day claim on 60-day detect)
    // Suppress line in copy when posting is older than 30 days
    const mostRecent = postings[0];
    const daysOld = mostRecent.date_posted_days_ago || 0;
    
    if (daysOld > 30) {
      ctx.log(`Freshness gate: posting is ${daysOld} days old (>30)`);
      return {
        data: {
          job_posting_line: '', // Suppress line
          role_named: aiResult.role_named,
          evidence_url: aiResult.evidence_url,
          confidence: 'low'
        },
        metadata: { abstained: true, reason: 'stale_posting' }
      };
    }
    
    return {
      data: aiResult,
      metadata: {
        confidence: aiResult.confidence,
        abstained: !aiResult.job_posting_line
      }
    };
  }
});

export default jobPostingLanguagePlay;
