export interface CIProvider {
  name: string;
  getPRIdentifier(): PRIdentifier | null;
  postComment(content: string, marker?: string): Promise<void>;
}

export interface PRIdentifier {
  provider: string;
  prNumber: string;
  repo: string;
}
