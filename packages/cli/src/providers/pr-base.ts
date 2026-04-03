/**
 * Detect the PR base ref from CI environment variables.
 * Returns the base branch/ref that the PR is targeting, or null if not in a PR context.
 */
export function detectPRBaseRef(): string | null {
  // GitHub Actions
  // GITHUB_BASE_REF is set on pull_request events
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  // GitLab CI
  // CI_MERGE_REQUEST_DIFF_BASE_SHA is the commit SHA of the base branch
  // CI_MERGE_REQUEST_TARGET_BRANCH_NAME is the branch name
  if (process.env.GITLAB_CI === 'true') {
    if (process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA) {
      return process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA;
    }
    if (process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME) {
      return `origin/${process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME}`;
    }
  }

  // Bitbucket Pipelines
  if (process.env.BITBUCKET_PIPELINE_UUID) {
    if (process.env.BITBUCKET_PR_DESTINATION_BRANCH) {
      return `origin/${process.env.BITBUCKET_PR_DESTINATION_BRANCH}`;
    }
  }

  // Azure DevOps
  if (process.env.TF_BUILD === 'True') {
    // SYSTEM_PULLREQUEST_TARGETBRANCH contains refs/heads/main format
    const targetBranch = process.env.SYSTEM_PULLREQUEST_TARGETBRANCH;
    if (targetBranch) {
      const branchName = targetBranch.replace('refs/heads/', '');
      return `origin/${branchName}`;
    }
  }

  return null;
}

/**
 * Check if we're currently running in a PR/MR context.
 */
export function isInPRContext(): boolean {
  return detectPRBaseRef() !== null;
}
