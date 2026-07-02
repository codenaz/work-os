import { SettingsService } from '../../settings/settings.service';
import { ClaudeCodeService } from './claude-code.service';

describe('ClaudeCodeService', () => {
  it('returns deterministic mock response in mock execution mode', async () => {
    const service = new ClaudeCodeService({
      getActionExecutionMode: jest.fn().mockResolvedValue('mock'),
      getGitHubSettings: jest.fn().mockResolvedValue({
        owner: 'codenaz',
        defaultRepository: 'work-os',
        defaultBaseBranch: 'main',
        executionRunner: 'claude',
        prCreationEnabled: true,
        defaultDraftPr: true,
        claudeRemoteEnabled: true,
        claudeCommand: 'claude',
        claudeWorkingDirectory: '/tmp/work-os-claude',
        configured: true,
      }),
    } as unknown as SettingsService);

    const result = await service.startRemoteTask({
      title: 'Add workflow safety checks',
      body: '## Summary\nAdd safety checks.',
      owner: 'codenaz',
      repository: 'work-os',
      baseBranch: 'main',
    });

    expect(result.mode).toBe('mock');
    expect(result.runner).toBe('claude');
    expect(result.repository).toBe('work-os');
    expect(result.workingDirectory).toContain(
      '/tmp/work-os-claude/mock-claude-',
    );
  });
});