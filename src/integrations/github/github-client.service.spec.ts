import { SettingsService } from '../../settings/settings.service';
import { GitHubClientService } from './github-client.service';

describe('GitHubClientService', () => {
  it('returns a mock pull request in mock mode', async () => {
    const service = new GitHubClientService({
      getActionExecutionMode: jest.fn().mockResolvedValue('mock'),
      getGitHubSettings: jest.fn().mockResolvedValue({
        token: 'token',
        owner: 'acme',
        defaultRepository: 'work-os',
        defaultBaseBranch: 'main',
        configured: true,
        prCreationEnabled: true,
        defaultDraftPullRequest: true,
      }),
    } as unknown as SettingsService);

    const result = await service.createPullRequest({
      source: 'slack',
      sourceEventId: 'Ev123',
      taskText: 'Implement safer GitHub PR workflow',
      title: 'Implement safer GitHub PR workflow',
      body: 'Adds conservative policy checks and draft defaults.',
    });

    expect(result.mode).toBe('mock');
    expect(result.repository).toBe('work-os');
    expect(result.baseBranch).toBe('main');
    expect(result.pullRequestUrl).toContain('github.mock.local');
    expect(result.draft).toBe(true);
  });
});
