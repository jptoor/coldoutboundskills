/**
 * Core Deepline play types
 * Ported from Clay workflows to TypeScript
 */

export interface PlayContext<TInput = any> {
  input: TInput;
  // Tool stubs - Clay equivalents
  tools: {
    http: <T = any>(config: HttpConfig) => Promise<T>;
    enrichCompany: (domain: string) => Promise<CompanyEnrichment>;
    searchPeople: (filters: PeopleSearchFilters) => Promise<Person[]>;
    scrapeWebsite: (url: string) => Promise<ScrapeResult>;
    findNews: (query: string, options?: NewsOptions) => Promise<NewsResult[]>;
    // AI/LLM calls
    ai: <T = any>(config: AIConfig) => Promise<T>;
  };
  // Database stubs - Clay → Deepline Customer DB + HubSpot
  db: {
    customers: CustomerDBStub;
    hubspot: HubSpotStub;
  };
  // Sequencer stub - Clay → Lemlist
  sequencer: LemlistStub;
  // Logging for debugging
  log: (...args: any[]) => void;
}

export interface PlayOutput<T = any> {
  data: T;
  metadata?: {
    confidence?: 'high' | 'medium' | 'low';
    evidence?: string;
    abstained?: boolean;
  };
}

export interface Play<TInput = any, TOutput = any> {
  name: string;
  version: string;
  description: string;
  inputSchema: any; // JSON schema
  outputSchema: any; // JSON schema
  run: (ctx: PlayContext<TInput>) => Promise<PlayOutput<TOutput>>;
}

// HTTP Tool
export interface HttpConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

// Company Enrichment
export interface CompanyEnrichment {
  name: string;
  domain: string;
  headcount?: number;
  industry?: string;
  funding?: {
    events?: Array<{
      stage: string;
      amount: number;
      raised_at: string;
      url?: string;
    }>;
  };
  linkedin_url?: string;
}

// People Search
export interface PeopleSearchFilters {
  titles?: string[];
  locations?: string[];
  companies?: string[];
  past_companies?: string[];
  headcount_min?: number;
  headcount_max?: number;
  time_in_role_max?: number;
}

export interface Person {
  full_name: string;
  first_name: string;
  last_name?: string;
  email?: string;
  linkedin_url?: string;
  current_employer?: string;
  current_employer_domain?: string;
  current_title?: string;
  job_history?: Array<{
    company: string;
    company_id?: string;
    company_domain?: string;
    title: string;
    start_year?: number;
    start_month?: number;
    end_year?: number;
    end_month?: number;
    is_current: boolean;
    dates?: string;
  }>;
  past_experiences?: Array<{
    company: string;
    company_domain?: string;
    title: string;
    dates?: string;
  }>;
  location?: string;
}

// Web Scraping
export interface ScrapeResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  text: string;
  html?: string;
}

// News
export interface NewsOptions {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface NewsResult {
  title: string;
  url: string;
  published_at: string;
  source?: string;
}

// AI/LLM
export interface AIConfig {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  reasoningLevel?: 'minimal' | 'low' | 'medium' | 'high';
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  jsonSchema?: any;
  retries?: number;
}

// Database Stubs
export interface CustomerDBStub {
  // TODO: implement against Deepline Customer DB
  query: (filters: any) => Promise<any[]>;
  upsert: (data: any) => Promise<void>;
}

export interface HubSpotStub {
  // TODO: implement against HubSpot API
  getContacts: (filters: any) => Promise<any[]>;
  createContact: (data: any) => Promise<any>;
  updateContact: (id: string, data: any) => Promise<any>;
}

// Sequencer Stub
export interface LemlistStub {
  // TODO: implement against Lemlist API
  // Stack substitution: Smartlead/Instantly → Lemlist
  addToCampaign: (campaignId: string, leads: any[]) => Promise<void>;
  getCampaigns: () => Promise<any[]>;
}

// Play Definition Helper
export function definePlay<TInput = any, TOutput = any>(
  config: Omit<Play<TInput, TOutput>, 'run'> & {
    run: (ctx: PlayContext<TInput>) => Promise<PlayOutput<TOutput>>;
  }
): Play<TInput, TOutput> {
  return config as Play<TInput, TOutput>;
}
