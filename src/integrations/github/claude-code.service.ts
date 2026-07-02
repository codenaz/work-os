import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { SettingsService } from '../../settings/settings.service';

const execFile = promisify(execFileCallback);

@Injectable()
export class ClaudeCodeService {
  constructor(private readonly settingsService: SettingsService) {}

  async startRemoteTask(params: {
    title: string;
    body: string;
    owner?: string;
    repository?: string;
    baseBranch?: string;
  }) {
    const executionMode = await this.settingsService.getActionExecutionMode();
    const githubSettings = await this.settingsService.getGitHubSettings();

    const owner = params.owner ?? githubSettings.owner;
    const repository = params.repository ?? githubSettings.defaultRepository;
    const baseBranch =
      params.baseBranch ?? githubSettings.defaultBaseBranch ?? 'main';

    if (!owner || !repository) {
      throw new ServiceUnavailableException(
        'Claude remote execution requires a resolvable GitHub owner and repository',
      );
    }

    if (!githubSettings.claudeRemoteEnabled) {
      throw new ServiceUnavailableException('Claude remote execution is disabled');
    }

    if (executionMode === 'mock') {
      const runId = `mock-claude-${Date.now()}`;
      return {
        mode: 'mock' as const,
        runner: 'claude' as const,
        owner,
        repository,
        baseBranch,
        runId,
        workingDirectory: join(githubSettings.claudeWorkingDirectory, runId),
        output: 'Claude remote task queued in mock mode.',
      };
    }

    if (!githubSettings.token) {
      throw new ServiceUnavailableException(
        'GitHub token is required for Claude clone-on-demand execution',
      );
    }

    await this.ensureClaudeInstalled(githubSettings.claudeCommand);

    await mkdir(githubSettings.claudeWorkingDirectory, { recursive: true });
    const workingDirectory = await mkdtemp(
      join(githubSettings.claudeWorkingDirectory, `${repository}-`),
    );
    const repoUrl = `https://github.com/${owner}/${repository}.git`;

    await execFile('git', [
      '-c',
      `http.extraHeader=Authorization: Bearer ${githubSettings.token}`,
      'clone',
      '--depth',
      '1',
      '--branch',
      baseBranch,
      repoUrl,
      workingDirectory,
    ]);

    const prompt = [params.title, '', params.body].join('\n');
    const { stdout, stderr } = await execFile(
      githubSettings.claudeCommand,
      ['--remote', prompt],
      { cwd: workingDirectory },
    );

    return {
      mode: 'live' as const,
      runner: 'claude' as const,
      owner,
      repository,
      baseBranch,
      workingDirectory,
      output: [stdout, stderr].filter(Boolean).join('\n').trim(),
    };
  }

  private async ensureClaudeInstalled(command: string) {
    try {
      await execFile(command, ['--version']);
    } catch {
      throw new ServiceUnavailableException(
        `Claude command '${command}' is not installed or not executable on this server`,
      );
    }
  }
}