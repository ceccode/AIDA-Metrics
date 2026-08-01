import type { CIProvider } from './types.js';
import { GitHubProvider } from './github.js';
import { GitLabProvider } from './gitlab.js';

export function detectProvider(): CIProvider | null {
  // GitHub Actions
  if (process.env.GITHUB_ACTIONS === 'true') {
    return new GitHubProvider();
  }

  // GitLab CI (#16)
  if (process.env.GITLAB_CI === 'true') {
    return new GitLabProvider();
  }

  // Azure DevOps — not yet implemented
  // if (process.env.TF_BUILD === 'True') { ... }

  return null;
}
