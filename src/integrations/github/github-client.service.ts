import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

interface GitHubRefResponse {
  object?: {
    sha?: string;
  };
}

interface GitHubPullRequestResponse {
  number?: number;
  html_url?: string;
}

@Injectable()
export class GitHubClientService {
  constructor(private readonly settingsService: SettingsService) {}

  async getConnectionStatus() {
    const githubSettings = await this.settingsService.getGitHubSettings();
    return {
      configured: githubSettings.configured,
      prCreationEnabled: githubSettings.prCreationEnabled,
    };
  }

  async createPullRequest(params: {
    source: 'slack' | 'jira';
    sourceEventId: string;
    taskText: string;
    title: string;
    body: string;
    owner?: string;
    repository?: string;
    baseBranch?: string;
    draft?: boolean;
  }) {
    const executionMode = await this.settingsService.getActionExecutionMode();
    const githubSettings = await this.settingsService.getGitHubSettings();

    if (!githubSettings.prCreationEnabled) {
      throw new ServiceUnavailableException(
        'GitHub PR creation is disabled by workspace settings',
      );
    }

    const owner = params.owner ?? githubSettings.owner;
    const repository = params.repository ?? githubSettings.defaultRepository;
    const baseBranch = params.baseBranch ?? githubSettings.defaultBaseBranch;
    const token = githubSettings.token;
    const draft = params.draft ?? githubSettings.defaultDraftPullRequest;

    if (!owner || !repository || !baseBranch || !token) {
      throw new ServiceUnavailableException(
        'GitHub PR creation requires token, owner, repository, and base branch configuration',
      );
    }

    const branchName = this.buildBranchName(
      params.source,
      params.sourceEventId,
    );
    const fallbackBody = [
      params.body,
      '',
      '---',
      `Source: ${params.source}`,
      `Source event: ${params.sourceEventId}`,
      '',
      params.taskText,
    ]
      .filter(Boolean)
      .join('\n')
      .trim();

    if (executionMode === 'mock') {
      return {
        mode: 'mock' as const,
        owner,
        repository,
        baseBranch,
        branchName,
        pullRequestNumber: Math.floor(Date.now() / 1000),
        pullRequestUrl: `https://github.mock.local/${owner}/${repository}/pull/1`,
        draft,
      };
    }

    const baseRef = await this.githubFetch<GitHubRefResponse>(
      `https://api.github.com/repos/${owner}/${repository}/git/ref/heads/${baseBranch}`,
      token,
    );
    const baseSha = baseRef.object?.sha;

    if (!baseSha) {
      throw new ServiceUnavailableException(
        `GitHub base branch "${baseBranch}" could not be resolved`,
      );
    }

    await this.githubFetch(
      `https://api.github.com/repos/${owner}/${repository}/git/refs`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      },
    );

    const filePath = `docs/work-os/auto-pr/${params.source}-${this.sanitizeBranchToken(params.sourceEventId)}.md`;
    await this.githubFetch(
      `https://api.github.com/repos/${owner}/${repository}/contents/${filePath}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: `chore(work-os): scaffold implementation for ${params.sourceEventId}`,
          content: Buffer.from(fallbackBody, 'utf8').toString('base64'),
          branch: branchName,
        }),
      },
    );

    const pullRequest = await this.githubFetch<GitHubPullRequestResponse>(
      `https://api.github.com/repos/${owner}/${repository}/pulls`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          title: params.title,
          head: branchName,
          base: baseBranch,
          body: fallbackBody,
          draft,
        }),
      },
    );

    if (!pullRequest.number || !pullRequest.html_url) {
      throw new ServiceUnavailableException(
        'GitHub pull request was created with an invalid response payload',
      );
    }

    return {
      mode: 'live' as const,
      owner,
      repository,
      baseBranch,
      branchName,
      pullRequestNumber: pullRequest.number,
      pullRequestUrl: pullRequest.html_url,
      draft,
    };
  }

  private buildBranchName(source: string, sourceEventId: string) {
    const timestamp = Date.now();
    return `work-os/${source}/${this.sanitizeBranchToken(sourceEventId)}-${timestamp}`;
  }

  private sanitizeBranchToken(input: string) {
    let sanitized = '';
    let previousWasHyphen = false;

    for (const char of input.toLowerCase()) {
      const isAlphaNumeric =
        (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9');
      if (isAlphaNumeric) {
        sanitized += char;
        previousWasHyphen = false;
        continue;
      }

      if (char === '/') {
        sanitized += '/';
        previousWasHyphen = false;
        continue;
      }

      if (!previousWasHyphen) {
        sanitized += '-';
        previousWasHyphen = true;
      }
    }

    while (sanitized.startsWith('-') || sanitized.startsWith('/')) {
      sanitized = sanitized.slice(1);
    }

    while (sanitized.endsWith('-') || sanitized.endsWith('/')) {
      sanitized = sanitized.slice(0, -1);
    }

    return sanitized.slice(0, 48);
  }

  private async githubFetch<T = unknown>(
    url: string,
    token: string,
    options?: RequestInit,
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: ['Bearer', token].join(' '),
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options?.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as T & {
      message?: string;
    };

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `GitHub API request failed: ${response.status} ${payload.message ?? response.statusText}`,
      );
    }

    return payload;
  }
}
