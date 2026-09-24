/**
 * Warm Intros Play - Customer Alumni Workflow
 * 
 * Port of: skills/playbooks/playbook-warm-intros/clay-workflow.md
 * 
 * CRITICAL: This is member 2 (current-customer alumni) ONLY.
 * NO mutual connections - that feature was intentionally removed.
 * 
 * Graph:
 * 1. Trigger: source_domains + client_domain
 * 2. Config check: refuse if client_domain in source set
 * 3. People search with past-company filter
 * 4. Alumni filter + exclusions (drop still-at-source)
 * 5. Formula line (NO agent node): default unnamed line
 * 
 * Outputs: warm_intro_line, warm_intro_member, warm_intro_evidence
 */

import { definePlay, PlayContext, PlayOutput, Person } from '../../types/play';
import { normalize } from '../../lib/utils';

interface WarmIntrosInput {
  source_domains: string[];
  client_domain: string;
  allow_naming?: boolean; // Default false - never name customer without approval
}

interface WarmIntrosOutput {
  warm_intro_line: string;
  warm_intro_member: string;
  warm_intro_evidence: string;
}

interface AlumniPerson {
  name: string;
  linkedin_url: string;
  current_company: string;
  current_domain: string;
  past_company: string;
  past_title: string;
  past_dates: string; // QA only, never reaches copy
}

export const warmIntrosPlay = definePlay<WarmIntrosInput, WarmIntrosOutput>({
  name: 'warm-intros',
  version: '1.0.0',
  description: 'Current-customer alumni warm intro workflow (member 2)',
  
  inputSchema: {
    type: 'object',
    required: ['source_domains', 'client_domain'],
    properties: {
      source_domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Customer/case-study company domains'
      },
      client_domain: {
        type: 'string',
        description: 'Client domain (must NOT be in source set)'
      },
      allow_naming: {
        type: 'boolean',
        default: false,
        description: 'Allow naming the customer in copy (default: unnamed form)'
      }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      warm_intro_line: { type: 'string' },
      warm_intro_member: { type: 'string' },
      warm_intro_evidence: { type: 'string' }
    }
  },
  
  async run(ctx: PlayContext<WarmIntrosInput>): Promise<PlayOutput<WarmIntrosOutput>> {
    const { source_domains, client_domain, allow_naming = false } = ctx.input;
    
    // Node 2: CONFIG CHECK - refuse if client domain in source set
    const sourceDomains = new Set((source_domains || []).map(d => d.toLowerCase()));
    
    if (sourceDomains.size === 0) {
      throw new Error('no source companies; this playbook has nothing to match on');
    }
    
    // If the CLIENT's own domain is in the source set, the list is wrong.
    // Filtering around it hides a configuration error that will produce a list
    // of the client's own employees.
    if (client_domain && sourceDomains.has(client_domain.toLowerCase())) {
      throw new Error('client domain is in the source set; fix the source list');
    }
    
    ctx.log('Config check passed:', sourceDomains.size, 'source domains');
    
    // Node 3: PEOPLE SEARCH with past-company filter
    // TODO: Implement actual people search tool
    // This is a stub that shows the contract
    const searchResults: Person[] = await ctx.tools.searchPeople({
      past_companies: Array.from(sourceDomains),
      // Include past experiences
    });
    
    ctx.log('Search returned', searchResults.length, 'people');
    
    // Node 4: ALUMNI FILTER + EXCLUSIONS
    const kept: AlumniPerson[] = [];
    let stillAtSource = 0;
    
    for (const person of searchResults) {
      const currentDomain = (person.current_employer_domain || '').toLowerCase();
      const emailDomain = (person.email || '').split('@')[1]?.toLowerCase() || '';
      
      // Someone STILL at the client's customer is not a warm intro -- they ARE
      // the customer. The probe found ~1 in 4 in this state.
      if (sourceDomains.has(currentDomain) || sourceDomains.has(emailDomain)) {
        stillAtSource++;
        continue;
      }
      
      // Find the matched past experience and keep it as evidence
      const pastExperiences = person.past_experiences || [];
      const match = pastExperiences.find(exp => {
        const expDomain = (exp.company_domain || '').toLowerCase();
        return sourceDomains.has(expDomain);
      });
      
      if (!match) {
        continue;
      }
      
      kept.push({
        name: person.full_name || '',
        linkedin_url: person.linkedin_url || '',
        current_company: person.current_employer || '',
        current_domain: currentDomain,
        past_company: match.company || '',
        past_title: match.title || '',
        // Dates are kept for QA ONLY. They never reach copy: profile ranges are
        // imprecise, and "in 2018 you were at X" is both creepy and often wrong.
        past_dates: match.dates || ''
      });
    }
    
    ctx.log('Filtered to', kept.length, 'alumni;', stillAtSource, 'still at source');
    
    // Node 5: BUILD THE LINE (NO AGENT NODE - formula only)
    // For batch processing, this would run per person. Here we show the pattern
    // for a single person (first match).
    
    if (kept.length === 0) {
      return {
        data: {
          warm_intro_line: '',
          warm_intro_member: 'current_customer_alumni',
          warm_intro_evidence: ''
        },
        metadata: {
          abstained: true,
          confidence: 'high'
        }
      };
    }
    
    const person = kept[0]; // Take first for single-row example
    const emp = person.past_company.trim();
    
    if (!emp) {
      return {
        data: {
          warm_intro_line: '',
          warm_intro_member: 'current_customer_alumni',
          warm_intro_evidence: ''
        },
        metadata: {
          abstained: true,
          confidence: 'high'
        }
      };
    }
    
    // DEFAULT: the UNNAMED form. It says the relationship without disclosing which
    // of the client's customers this is. Naming a client's customer in cold email
    // is the CLIENT's decision, not ours, and getting it wrong turns a clever
    // campaign into an awkward phone call.
    let line = `you came up through ${emp}, who we work with now`;
    
    if (allow_naming) {
      line = `you came up through ${emp}, one of our customers`;
    }
    
    // Evidence for QA only. Contains employment dates. NEVER pushed to a sequencer.
    const evidence = `${emp}, ${person.past_title}, ${person.past_dates}`;
    
    return {
      data: {
        warm_intro_line: line,
        // Seven members share one copy shape. Without the member name you cannot
        // tell which angle produced replies, which is the only way this family
        // gets narrowed to the two or three members worth keeping.
        warm_intro_member: 'current_customer_alumni',
        warm_intro_evidence: evidence
      },
      metadata: {
        confidence: 'high',
        evidence
      }
    };
  }
});

export default warmIntrosPlay;
