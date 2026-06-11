import { SettingsService } from '../../settings/settings.service';
import { GitHubClientService } from './github-client.service';

describe('GitHubClientService', () => {
  it('returns deterministic mock-style response in mock execution mode', async () => {
    const service = new GitHubClientService({
      getActionExecutionMode: jest.fn().mockResolvedValue('mock'),
    } as unknown as SettingsService);

    const result = await service.createPullRequest({
      title: 'Add workflow safety checks',
      body: '## Summary\nAdd safety checks.',
      repository: 'work-os',
    });

    expect(result.mode).toBe('mock');
    expect(result.repository).toBe('work-os');
    expect(result.branch).toContain('work-os/mock-pr-');
    expect(result.pullRequestUrl).toContain(
      'https://github.com/mock-org/work-os/pull/',
    );
  });
});
