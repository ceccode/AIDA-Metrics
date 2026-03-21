import type { CIProvider } from './types.js';
import { GitHubProvider } from './github.js';

export function detectProvider(): CIProvider | null {
  // GitHub Actions
  if (process.env.GITHUB_ACTIONS === 'true') {
    return new GitHubProvider();
  }

  // GitLab CI — not yet implemented
  // if (process.env.GITLAB_CI === 'true') { ... }

  // Bitbucket Pipelines — not yet implemented
  // if (process.env.BITBUCKET_PIPELINE_UUID) { ... }

  // Azure DevOps — not yet implemented
  // if (process.env.TF_BUILD === 'True') { ... }

  return null;
}
