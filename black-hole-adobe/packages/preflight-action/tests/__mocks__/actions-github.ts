/**
 * Mock for @actions/github
 */

interface MockComment {
  id: number;
  body: string;
}

interface MockFile {
  filename: string;
  status: string;
}

let mockComments: MockComment[] = [];
let mockFiles: MockFile[] = [];
let createdComments: Array<{ issue_number: number; body: string }> = [];
let updatedComments: Array<{ comment_id: number; body: string }> = [];

export function setMockPRFiles(files: MockFile[]): void {
  mockFiles = files;
}

export function setMockComments(comments: MockComment[]): void {
  mockComments = comments;
}

export function getCreatedComments() {
  return [...createdComments];
}

export function getUpdatedComments() {
  return [...updatedComments];
}

export function resetGithubMocks(): void {
  mockComments = [];
  mockFiles = [];
  createdComments = [];
  updatedComments = [];
  context.payload = { pull_request: { number: 42 } };
  context.eventName = 'pull_request';
}

// --- @actions/github API ---

export const context = {
  payload: {
    pull_request: { number: 42 },
  } as Record<string, unknown>,
  repo: { owner: 'test-owner', repo: 'test-repo' },
  eventName: 'pull_request',
};

export function getOctokit(_token: string) {
  return {
    rest: {
      pulls: {
        listFiles: async (params: { page: number; per_page: number }) => {
          const start = (params.page - 1) * params.per_page;
          const end = start + params.per_page;
          return { data: mockFiles.slice(start, end) };
        },
      },
      issues: {
        listComments: async (params: { page: number; per_page: number }) => {
          const start = (params.page - 1) * params.per_page;
          const end = start + params.per_page;
          return { data: mockComments.slice(start, end) };
        },
        createComment: async (params: { issue_number: number; body: string }) => {
          createdComments.push({ issue_number: params.issue_number, body: params.body });
          return { data: { id: 999 } };
        },
        updateComment: async (params: { comment_id: number; body: string }) => {
          updatedComments.push({ comment_id: params.comment_id, body: params.body });
          return { data: { id: params.comment_id } };
        },
      },
    },
  };
}
