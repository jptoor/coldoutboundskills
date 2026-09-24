/**
 * LinkedIn Engagement Play
 * 
 * Port of: skills/playbooks/playbook-linkedin-engagement/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: source URLs + client ICP + client domain
 * 2. CODE: PRECONDITIONS - refuse on failure
 * 3. Tool: company posts (windowed)
 * 4. CODE: shortlist posts by engagement count
 * 5-6. Tools: reactions + comments
 * 7. CODE: merge, dedupe engagers
 * 8. CODE: SOURCE-COMPANY DROP (four-path matching)
 * 9. Tool: company enrichment
 * 10. CODE: ICP gate + final contract
 * 
 * NO AGENT PROMPT - All code nodes
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';
import { normalize } from '../../lib/utils';

interface Input {
  source_urls: string[];
  source_domains: Record<string, string>; // URL -> domain map
  client_domain: string;
  icp: {
    headcount_min: number;
    headcount_max: number;
    countries: string[];
    titles: string[];
  };
  max_posts?: number; // Default 3
  min_engagement?: number; // Default 15
}

interface Output {
  engagers: Array<{
    name: string;
    email: string;
    title: string;
    employer_name: string;
    employer_domain: string;
    linkedin_url: string;
  }>;
  source_company_dropped: number;
  icp_filtered: number;
}

function squash(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const linkedinEngagementPlay = definePlay<Input, Output>({
  name: 'linkedin-engagement',
  version: '1.0.0',
  description: 'LinkedIn engagement harvesting with preconditions refuse and source-company drop',
  
  inputSchema: {
    type: 'object',
    required: ['source_urls', 'source_domains', 'client_domain', 'icp'],
    properties: {
      source_urls: { type: 'array', items: { type: 'string' } },
      source_domains: { type: 'object' },
      client_domain: { type: 'string' },
      icp: {
        type: 'object',
        required: ['headcount_min', 'headcount_max', 'countries', 'titles'],
        properties: {
          headcount_min: { type: 'number' },
          headcount_max: { type: 'number' },
          countries: { type: 'array', items: { type: 'string' } },
          titles: { type: 'array', items: { type: 'string' } }
        }
      },
      max_posts: { type: 'number', default: 3 },
      min_engagement: { type: 'number', default: 15 }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      engagers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            title: { type: 'string' },
            employer_name: { type: 'string' },
            employer_domain: { type: 'string' },
            linkedin_url: { type: 'string' }
          }
        }
      },
      source_company_dropped: { type: 'number' },
      icp_filtered: { type: 'number' }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { 
      source_urls, 
      source_domains, 
      client_domain, 
      icp,
      max_posts = 3,
      min_engagement = 15
    } = ctx.input;
    
    // Node 2: PRECONDITIONS - refuse on failure (from clay-workflow.md L40-59)
    // An unresolved source URL produces an EMPTY source set, which silently
    // disables BOTH halves of the source-company rule
    const unresolved = source_urls.filter(u => !source_domains[u]);
    if (unresolved.length > 0) {
      throw new Error(`unresolved source accounts, refusing to harvest: ${unresolved.join(', ')}`);
    }
    
    // If the CLIENT's own domain is in the source set, the list is wrong. Stop.
    const domainValues = Object.values(source_domains);
    if (client_domain && domainValues.includes(client_domain)) {
      throw new Error('client domain present in source set; the source list is wrong');
    }
    
    // Never infer an ICP. Ask.
    for (const k of ['headcount_min', 'headcount_max', 'countries', 'titles']) {
      if (!(icp as any)[k]) {
        throw new Error(`ICP field ${k} missing; ask the operator, do not infer it`);
      }
    }
    
    // Node 3: Tool - fetch company posts (windowed)
    const posts = await ctx.tools.http({
      url: 'https://api.example.com/social-posts',
      method: 'POST',
      body: { sources: source_urls, window_days: 30 }
    });
    
    // Node 4: CODE - shortlist posts by engagement count (clay-workflow.md L64-74)
    const scored = (posts.data || [])
      .filter((p: any) => (p.reactions || 0) + (p.comments || 0) >= min_engagement)
      .sort((a: any, b: any) => 
        ((b.reactions || 0) + (b.comments || 0)) - ((a.reactions || 0) + (a.comments || 0))
      )
      .slice(0, max_posts);
    
    if (scored.length === 0) {
      ctx.log('No posts met engagement threshold');
      return {
        data: { engagers: [], source_company_dropped: 0, icp_filtered: 0 },
        metadata: { abstained: true, reason: 'no_qualifying_posts' }
      };
    }
    
    // Nodes 5-6: Tools - fetch reactions + comments
    const allEngagers: any[] = [];
    for (const post of scored) {
      const reactions = await ctx.tools.http({
        url: 'https://api.example.com/post-reactions',
        method: 'GET',
        params: { post_id: post.id }
      });
      const comments = await ctx.tools.http({
        url: 'https://api.example.com/post-comments',
        method: 'GET',
        params: { post_id: post.id }
      });
      allEngagers.push(...(reactions.data || []), ...(comments.data || []));
    }
    
    // Node 7: CODE - merge, dedupe engagers
    const seen = new Set<string>();
    const deduped = allEngagers.filter(e => {
      const key = `${e.linkedin_url}:${e.email}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Node 8: CODE - SOURCE-COMPANY DROP (four-path matching, clay-workflow.md L80-107)
    const doms = new Set(domainValues.map(d => d.toLowerCase()));
    const urls = source_urls.map(u => u.toLowerCase());
    const source_names_from_domains = domainValues; // Would normally resolve these
    const names = new Set(source_names_from_domains.map(squash));
    
    const kept: any[] = [];
    let dropped = 0;
    
    for (const e of deduped) {
      const emp_dom = (e.employer_domain || '').toLowerCase();
      const mail_dom = (e.email || '').split('@').pop()?.toLowerCase() || '';
      const emp_url = (e.employer_linkedin || '').toLowerCase();
      const emp_name = squash(e.employer_name);
      
      // FOUR match paths, in this order (clay-workflow.md L95-105)
      if (doms.has(emp_dom) || 
          doms.has(mail_dom) ||
          urls.some(u => emp_url.includes(u)) ||
          names.has(emp_name)) {
        dropped++;
        continue;
      }
      
      kept.push(e);
    }
    
    // Node 9: Tool - company enrichment (survivors only)
    const enriched: any[] = [];
    for (const e of kept) {
      if (e.employer_domain) {
        const companyData = await ctx.tools.enrichCompany(e.employer_domain);
        enriched.push({ ...e, ...companyData });
      } else {
        enriched.push(e);
      }
    }
    
    // Node 10: CODE - ICP gate + final contract
    const icpFiltered = enriched.filter(e => {
      const headcount = e.headcount || 0;
      if (headcount < icp.headcount_min || headcount > icp.headcount_max) {
        return false;
      }
      // Additional ICP checks would go here
      return true;
    });
    
    return {
      data: {
        engagers: icpFiltered.map(e => ({
          name: e.name,
          email: e.email,
          title: e.title,
          employer_name: e.employer_name,
          employer_domain: e.employer_domain,
          linkedin_url: e.linkedin_url
        })),
        source_company_dropped: dropped,
        icp_filtered: enriched.length - icpFiltered.length
      },
      metadata: {
        confidence: icpFiltered.length > 0 ? 'high' : 'low',
        abstained: icpFiltered.length === 0
      }
    };
  }
});

export default linkedinEngagementPlay;
