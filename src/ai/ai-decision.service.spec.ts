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
    expect(decision.githubPrTitle).toBeDefined();
    expect(decision.githubPrBody).toContain('## Summary');
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
