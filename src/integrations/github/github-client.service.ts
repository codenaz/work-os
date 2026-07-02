import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

interface CopilotTaskResponse {
  id?: string | number;
  state?: string;
  html_url?: string;
  web_url?: string;
  url?: string;
}

@Injectable()
export class GitHubClientService {
  constructor(private readonly settingsService: SettingsService) {}

  async getConnectionStatus() {
    const githubSettings = await this.settingsService.getGitHubSettings();
    return {
      configured: githubSettings.configured,
      owner: githubSettings.owner,
      defaultRepository: githubSettings.defaultRepository,
      prCreationEnabled: githubSettings.prCreationEnabled,
    };
  }

  async startCopilotTask(params: {
    title: string;
    body: string;
    repository?: string;
    owner?: string;
    baseBranch?: string;
    draft?: boolean;
  }) {
    const executionMode = await this.settingsService.getActionExecutionMode();

    if (executionMode === 'mock') {
      const timestamp = Date.now();
      const repository = params.repository ?? 'mock-repository';
      const owner = params.owner ?? 'mock-org';
      const taskId = `mock-task-${timestamp}`;
      return {
        mode: 'mock' as const,
        owner,
        repository,
        taskId,
        taskState: 'queued',
        taskUrl: `https://github.com/${owner}/${repository}/copilot/tasks/${taskId}`,
        draft: params.draft ?? true,
      };
    }

    const githubSettings = await this.settingsService.getGitHubSettings();

    if (
      !githubSettings.token ||
      !githubSettings.owner ||
      !githubSettings.defaultRepository
    ) {
      throw new ServiceUnavailableException(
        'GitHub settings are not fully configured for PR creation',
      );
    }

    if (!githubSettings.prCreationEnabled) {
      throw new ServiceUnavailableException('GitHub PR creation is disabled');
    }

    const owner = params.owner ?? githubSettings.owner;
    const repository = params.repository ?? githubSettings.defaultRepository;
    const baseBranch =
      params.baseBranch ?? githubSettings.defaultBaseBranch ?? 'main';
    const draft = params.draft ?? githubSettings.defaultDraftPr;

    const prompt = [
      `Open a ${draft ? 'draft ' : ''}pull request for the repository ${owner}/${repository}.`,
      `Use ${baseBranch} as the base branch.`,
      '',
      `Title: ${params.title}`,
      '',
      params.body,
    ].join('\n');

    const task = await this.githubRequest<CopilotTaskResponse>({
      token: githubSettings.token,
      path: `/agents/repos/${owner}/${repository}/tasks`,
      method: 'POST',
      body: {
        prompt,
        base_ref: baseBranch,
        create_pull_request: true,
      },
    });

    const taskId = task.id === undefined ? undefined : String(task.id);

    if (!taskId) {
      throw new ServiceUnavailableException(
        'Copilot cloud agent response was missing a task identifier',
      );
    }

    return {
      mode: 'live' as const,
      owner,
      repository,
      taskId,
      taskState: task.state ?? 'queued',
      taskUrl: task.html_url ?? task.web_url ?? task.url,
      draft,
      baseBranch,
    };
  }

  private async githubRequest<T = Record<string, unknown>>(params: {
    token: string;
    path: string;
    method: 'GET' | 'POST' | 'PUT';
    body?: Record<string, unknown>;
  }): Promise<T> {
    const response = await fetch(`https://api.github.com${params.path}`, {
      method: params.method,
      headers: {
        Authorization: 'Bearer ' + params.token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      ...(params.body ? { body: JSON.stringify(params.body) } : {}),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `GitHub API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }
}
