import { SettingsService } from '../settings/settings.service';
import { AiDecisionService } from './ai-decision.service';
import { AiProviderFactory } from './ai-provider.factory';

describe('AiDecisionService', () => {
  const baseAiSettings = {
    selectedProvider: 'stub',
    mode: 'stub',
    openAiModel: 'gpt-4.1-mini',
    openAiApiKeyConfigured: false,
    anthropicModel: 'claude-3-5-sonnet-latest',
    anthropicApiKeyConfigured: false,
  } as const;

  it('routes actionable work to Jira in stub mode', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      {
        getAiSettings: jest.fn().mockResolvedValue(baseAiSettings),
        getGitHubSettings: jest.fn().mockResolvedValue({
          configured: true,
          owner: 'acme',
          defaultRepository: 'work-os',
          defaultBaseBranch: 'main',
          token: 'token',
          prCreationEnabled: true,
          defaultDraftPullRequest: true,
        }),
      } as unknown as SettingsService,
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

  it('chooses create_github_pr for sufficiently detailed Slack requests', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      {
        getAiSettings: jest.fn().mockResolvedValue(baseAiSettings),
        getGitHubSettings: jest.fn().mockResolvedValue({
          configured: true,
          owner: 'acme',
          defaultRepository: 'work-os',
          defaultBaseBranch: 'main',
          token: 'token',
          prCreationEnabled: true,
          defaultDraftPullRequest: true,
        }),
      } as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'slack',
      sourceEventId: 'Ev124',
      eventType: 'app_mention',
      idempotencyKey: 'slack:Ev124',
      correlationId: 'Ev124',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'U123',
      },
      conversation: {
        channelId: 'C123',
      },
      content: {
        text: 'Please create PR to implement GitHub webhook ingestion and update policy enforcement with tests',
      },
      raw: {},
    });

    expect(decision.action).toBe('create_github_pr');
    expect(decision.githubPrTitle).toContain('create PR');
    expect(decision.githubDraft).toBe(true);
  });

  it('skips GitHub PR creation when context is weak', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      {
        getAiSettings: jest.fn().mockResolvedValue(baseAiSettings),
        getGitHubSettings: jest.fn().mockResolvedValue({
          configured: true,
          owner: 'acme',
          defaultRepository: 'work-os',
          defaultBaseBranch: 'main',
          token: 'token',
          prCreationEnabled: true,
          defaultDraftPullRequest: true,
        }),
      } as unknown as SettingsService,
    );

    const decision = await service.decide({
      source: 'jira',
      sourceEventId: 'jira-123',
      eventType: 'jira:issue_updated',
      idempotencyKey: 'jira:jira-123',
      correlationId: 'jira-123',
      receivedAt: new Date().toISOString(),
      actor: {
        id: 'jira-user',
      },
      content: {
        text: 'create pr',
      },
      raw: {},
    });

    expect(decision.action).toBe('skip_event');
    expect(decision.rationale).toContain(
      'Autonomous PR creation is conservative',
    );
  });
});
