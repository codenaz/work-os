import { SettingsService } from '../settings/settings.service';
import { AiDecisionService } from './ai-decision.service';
import { AiProviderFactory } from './ai-provider.factory';

describe('AiDecisionService', () => {
  const stubSettings = {
    getAiSettings: jest.fn().mockResolvedValue({
      selectedProvider: 'stub',
      mode: 'stub',
      openAiModel: 'gpt-4.1-mini',
      openAiApiKeyConfigured: false,
      anthropicModel: 'claude-3-5-sonnet-latest',
      anthropicApiKeyConfigured: false,
    }),
    getGitHubSettings: jest.fn().mockResolvedValue({
      token: 'github-user-token',
      owner: 'codenaz',
      defaultRepository: 'work-os',
      defaultBaseBranch: 'main',
      executionRunner: 'copilot',
      prCreationEnabled: true,
      defaultDraftPr: true,
      claudeRemoteEnabled: false,
      claudeCommand: 'claude',
      claudeWorkingDirectory: '/tmp/work-os-claude',
      configured: true,
    }),
  };

  it('routes actionable work to Jira in stub mode', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      stubSettings as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'slack',
      sourceEventId: 'Ev123',
      eventType: 'app_mention',
      idempotencyKey: 'slack:Ev123',
      correlationId: 'Ev123',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'U123',
      },
      conversation: {
        channelId: 'C123',
        messageTs: '123.456',
        threadTs: '123.456',
      },
      content: {
        text: 'Please create a Jira ticket for this production bug',
      },
      raw: {},
    });

    expect(decision.action).toBe('create_jira_ticket');
    expect(decision.provider).toBe('stub');
    expect(decision.jiraSummary).toContain('Please create a Jira ticket');
  });

  it('selects create_github_pr when a detailed Slack request asks for a PR', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      stubSettings as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'slack',
      sourceEventId: 'Ev789',
      eventType: 'app_mention',
      idempotencyKey: 'slack:Ev789',
      correlationId: 'Ev789',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'U999',
      },
      conversation: {
        channelId: 'C123',
      },
      content: {
        text: 'Please create PR to implement a GitHub webhook controller and update settings service with conservative validation and tests.',
      },
      raw: {},
    });

    expect(decision.action).toBe('create_github_pr');
    expect(decision.githubExecutionRunner).toBe('copilot');
    expect(decision.githubRepositoryOwner).toBe('codenaz');
    expect(decision.githubRepository).toBe('work-os');
    expect(decision.githubPrTitle).toBeDefined();
    expect(decision.githubPrBody).toContain('## Summary');
  });

  it('selects the claude runner when configured and available', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      {
        ...stubSettings,
        getGitHubSettings: jest.fn().mockResolvedValue({
          token: 'github-user-token',
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
      } as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'slack',
      sourceEventId: 'Ev790',
      eventType: 'app_mention',
      idempotencyKey: 'slack:Ev790',
      correlationId: 'Ev790',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'U999',
      },
      conversation: {
        channelId: 'C123',
      },
      content: {
        text: 'Please create PR to implement a GitHub webhook controller and update settings service with conservative validation and tests.',
      },
      raw: {},
    });

    expect(decision.action).toBe('create_github_pr');
    expect(decision.githubExecutionRunner).toBe('claude');
  });

  it('extracts an explicit repository URL from event context for GitHub tasks', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      stubSettings as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'jira',
      sourceEventId: 'jira-777',
      eventType: 'jira:issue_updated',
      idempotencyKey: 'jira:jira-777',
      correlationId: 'jira-777',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'jira-user',
      },
      content: {
        text: 'Create PR to implement the webhook validation fix in repo https://github.com/octo-org/edge-api and add tests for the service and controller.',
      },
      raw: {},
    });

    expect(decision.action).toBe('create_github_pr');
    expect(decision.githubExecutionRunner).toBe('copilot');
    expect(decision.githubRepositoryOwner).toBe('octo-org');
    expect(decision.githubRepository).toBe('edge-api');
  });

  it('coerces create_github_pr to skip_event when context is weak', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      stubSettings as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'slack',
      sourceEventId: 'Ev111',
      eventType: 'app_mention',
      idempotencyKey: 'slack:Ev111',
      correlationId: 'Ev111',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'U222',
      },
      conversation: {
        channelId: 'C123',
      },
      content: {
        text: 'create pr',
      },
      raw: {},
    });

    expect(decision.action).toBe('skip_event');
    expect(decision.rationale).toContain('requires explicit, bounded context');
  });

  it('skips GitHub PR creation when no repository can be resolved', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      {
        ...stubSettings,
        getGitHubSettings: jest.fn().mockResolvedValue({
          token: 'github-user-token',
          owner: undefined,
          defaultRepository: undefined,
          defaultBaseBranch: 'main',
          executionRunner: 'copilot',
          prCreationEnabled: false,
          defaultDraftPr: true,
          claudeRemoteEnabled: false,
          claudeCommand: 'claude',
          claudeWorkingDirectory: '/tmp/work-os-claude',
          configured: false,
        }),
      } as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'slack',
      sourceEventId: 'Ev999',
      eventType: 'app_mention',
      idempotencyKey: 'slack:Ev999',
      correlationId: 'Ev999',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'U123',
      },
      conversation: {
        channelId: 'C123',
      },
      content: {
        text: 'Please create PR to implement webhook validation and add tests for the controller and service.',
      },
      raw: {},
    });

    expect(decision.action).toBe('skip_event');
    expect(decision.rationale).toContain(
      'requires a resolvable repository target',
    );
  });

  it('does not choose respond_in_slack for non-slack events in stub mode', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      stubSettings as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'jira',
      sourceEventId: 'jira-123',
      eventType: 'issue_updated',
      idempotencyKey: 'jira:jira-123',
      correlationId: 'jira-123',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'jira-user',
      },
      content: {
        text: 'Heads up, this was acknowledged by the team.',
      },
      raw: {},
    });

    expect(decision.action).toBe('skip_event');
    expect(decision.jiraSummary).toBeUndefined();
    expect(decision.rationale).toContain('should not create loops');
  });
});
