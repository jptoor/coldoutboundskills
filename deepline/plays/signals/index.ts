/**
 * Deepline Plays - Signal Playbook Exports
 * 
 * Faithful TypeScript ports of Clay workflows
 * All 19 playbooks with clay-workflow.md are now ported
 */

// Person signals
export { newInRolePlay } from './new-in-role.play';
export { warmIntrosPlay } from './warm-intros.play';
export { linkedinEngagementPlay } from './linkedin-engagement.play';
export { socialPostsPlay } from './social-posts.play';

// Company signals
export { fundingSignalPlay } from './funding-signal.play';
export { hiringSurgePlay } from './hiring-surge.play';
export { jobPostingLanguagePlay } from './job-posting-language.play';
export { adLibraryPlay } from './ad-library.play';

// Website signals
export { pricingPagePlay } from './pricing-page.play';
export { caseStudyPagePlay } from './case-study-page.play';
export { techOnWebsitePlay } from './tech-on-website.play';
export { googleSiteSearchPlay } from './google-site-search.play';

// List shaping
export { companyNameCleaningPlay } from './company-name-cleaning.play';
export { firstNameCleaningPlay } from './first-name-cleaning.play';
export { socialLinkFindingPlay } from './social-link-finding.play';
export { lookalikesPlay } from './lookalikes.play';
export { nameToOtherProspectsPlay } from './name-to-other-prospects.play';

// Copy generation
export { aiSpecificityPlay } from './ai-specificity.play';
export { creativeIdeasPlay } from './creative-ideas.play';

/**
 * Get all available plays (19/19)
 */
export const getAllPlays = () => {
  return {
    // Person signals
    'new-in-role': newInRolePlay,
    'warm-intros': warmIntrosPlay,
    'linkedin-engagement': linkedinEngagementPlay,
    'social-posts': socialPostsPlay,
    
    // Company signals
    'funding-signal': fundingSignalPlay,
    'hiring-surge': hiringSurgePlay,
    'job-posting-language': jobPostingLanguagePlay,
    'ad-library': adLibraryPlay,
    
    // Website signals
    'pricing-page': pricingPagePlay,
    'case-study-page': caseStudyPagePlay,
    'tech-on-website': techOnWebsitePlay,
    'google-site-search': googleSiteSearchPlay,
    
    // List shaping
    'company-name-cleaning': companyNameCleaningPlay,
    'first-name-cleaning': firstNameCleaningPlay,
    'social-link-finding': socialLinkFindingPlay,
    'lookalikes': lookalikesPlay,
    'name-to-other-prospects': nameToOtherProspectsPlay,
    
    // Copy generation
    'ai-specificity': aiSpecificityPlay,
    'creative-ideas': creativeIdeasPlay
  };
};

/**
 * Get play by name
 */
export const getPlay = (name: string) => {
  const plays = getAllPlays();
  return plays[name as keyof typeof plays];
};
