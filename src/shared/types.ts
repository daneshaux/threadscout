export type DuplicateCaseStatus =
  | "pending"
  | "redirected"
  | "removed"
  | "ignored";

export type DuplicateCase = {
  id: string;

  duplicatePostId: string;
  duplicateTitle: string;
  duplicatePermalink?: string;

  originalPostId: string;
  originalTitle: string;
  originalPermalink?: string;

  similarityScore: number;
  aiExplanation?: string;

  subredditName: string;
  createdAt: number;

  status: DuplicateCaseStatus;
};