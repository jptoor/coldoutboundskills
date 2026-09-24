/**
 * Deepline Plays - Signal Playbook Exports
 * 
 * Faithful TypeScript ports of Clay workflows
 */

// Fully ported plays
export { warmIntrosPlay } from './warm-intros.play';
export { fundingSignalPlay } from './funding-signal.play';
export { newInRolePlay } from './new-in-role.play';
export { companyNameCleaningPlay } from './company-name-cleaning.play';
export { firstNameCleaningPlay } from './first-name-cleaning.play';
export { pricingPagePlay } from './pricing-page.play';

// Plays with faithful logic, needing tool integration
export { hiringSurgePlay } from './hiring-surge.play';
export { socialLinkFindingPlay } from './social-link-finding.play';
export { caseStudyPagePlay } from './case-study-page.play';

// TODO: Export remaining 10 plays as they're created
// - linkedin-engagement
// - social-posts
// - tech-on-website
// - google-site-search
// - job-posting-language
// - lookalikes
// - name-to-other-prospects
// - ad-library
// - creative-ideas
// - ai-specificity

/**
 * Get all available plays
 */
export const getAllPlays = () => {
  return {
    // Person signals
    'new-in-role': newInRolePlay,
    'warm-intros': warmIntrosPlay,
    
    // Company signals
    'funding-signal': fundingSignalPlay,
    'hiring-surge': hiringSurgePlay,
    
    // Website signals
    'pricing-page': pricingPagePlay,
    'case-study-page': caseStudyPagePlay,
    
    // List shaping
    'company-name-cleaning': companyNameCleaningPlay,
    'first-name-cleaning': firstNameCleaningPlay,
    'social-link-finding': socialLinkFindingPlay
  };
};

/**
 * Get play by name
 */
export const getPlay = (name: string) => {
  const plays = getAllPlays();
  return plays[name as keyof typeof plays];
};
