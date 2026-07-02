import { SettingsService } from '../../settings/settings.service';
import { GitHubClientService } from './github-client.service';

describe('GitHubClientService', () => {
  it('returns deterministic mock cloud-agent task response in mock execution mode', async () => {
    const service = new GitHubClientService({
      getActionExecutionMode: jest.fn().mockResolvedValue('mock'),
    } as unknown as SettingsService);

    const result = await service.startCopilotTask({
      title: 'Add workflow safety checks',
      body: '## Summary\nAdd safety checks.',
      repository: 'work-os',
      owner: 'codenaz',
    });

    expect(result.mode).toBe('mock');
    expect(result.owner).toBe('codenaz');
    expect(result.repository).toBe('work-os');
    expect(result.taskId).toContain('mock-task-');
    expect(result.taskState).toBe('queued');
    expect(result.taskUrl).toContain(
      'https://github.com/codenaz/work-os/copilot/tasks/',
    );
  });
});
