import { SettingsService } from '../settings/settings.service';
import { AiDecisionService } from './ai-decision.service';
import { AiProviderFactory } from './ai-provider.factory';

describe('AiDecisionService', () => {
  it('routes actionable work to Jira in stub mode', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      {
        getAiSettings: jest.fn().mockResolvedValue({
          selectedProvider: 'stub',
          mode: 'stub',
          openAiModel: 'gpt-4.1-mini',
          openAiApiKeyConfigured: false,
          anthropicModel: 'claude-3-5-sonnet-latest',
          anthropicApiKeyConfigured: false,
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

  it('does not choose respond_in_slack for non-slack events in stub mode', async () => {
    const service = new AiDecisionService(
      {} as AiProviderFactory,
      {
        getAiSettings: jest.fn().mockResolvedValue({
          selectedProvider: 'stub',
          mode: 'stub',
          openAiModel: 'gpt-4.1-mini',
          openAiApiKeyConfigured: false,
          anthropicModel: 'claude-3-5-sonnet-latest',
          anthropicApiKeyConfigured: false,
        }),
      } as unknown as SettingsService,
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
