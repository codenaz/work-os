import { InternalServerErrorException } from '@nestjs/common';
import { CanonicalEvent } from '../events/canonical-event';
import { JiraClientService } from '../integrations/jira/jira-client.service';
import { SlackClientService } from '../integrations/slack/slack-client.service';
import { InternalToolExecutorService } from './internal-tool-executor.service';
import { WorkflowDecision } from './ai.types';

describe('InternalToolExecutorService', () => {
  const baseEvent: CanonicalEvent = {
    source: 'jira',
    sourceEventId: 'evt_123',
    eventType: 'issue_updated',
    idempotencyKey: 'jira:evt_123',
    correlationId: 'evt_123',
    receivedAt: new Date().toISOString(),
    actor: {
      id: 'user-1',
    },
    content: {
      text: 'Please track this follow up task',
    },
    raw: {},
  };

  it('creates a Jira ticket without requiring a Slack channel', async () => {
    const slackClientService = {
      sendMessage: jest.fn(),
    } as unknown as SlackClientService;
    const jiraClientService = {
      createIssue: jest.fn().mockResolvedValue({
        issueKey: 'OPS-101',
        issueUrl: 'https://jira.example.com/browse/OPS-101',
      }),
    } as unknown as JiraClientService;

    const service = new InternalToolExecutorService(
      slackClientService,
      jiraClientService,
    );

    const decision: WorkflowDecision = {
      action: 'create_jira_ticket',
      responseText: 'Created a Jira ticket for follow-up.',
      jiraSummary: 'Track follow-up work',
      jiraDescription: 'Please track this follow up task',
      rationale: 'Durable work should be captured in Jira.',
      confidence: 'high',
      provider: 'stub',
      model: 'rule-based-router',
    };

    await expect(service.execute(decision, baseEvent)).resolves.toEqual({
      output: {
        jiraIssue: {
          issueKey: 'OPS-101',
          issueUrl: 'https://jira.example.com/browse/OPS-101',
        },
      },
    });
    expect(jiraClientService.createIssue).toHaveBeenCalledWith({
      summary: 'Track follow-up work',
      description: 'Please track this follow up task',
    });
    expect(slackClientService.sendMessage).not.toHaveBeenCalled();
  });

  it('can skip an event without invoking downstream clients', async () => {
    const slackClientService = {
      sendMessage: jest.fn(),
    } as unknown as SlackClientService;
    const jiraClientService = {
      createIssue: jest.fn(),
    } as unknown as JiraClientService;

    const service = new InternalToolExecutorService(
      slackClientService,
      jiraClientService,
    );

    const decision: WorkflowDecision = {
      action: 'skip_event',
      responseText: 'Recorded only.',
      rationale: 'No external action should be taken.',
      confidence: 'high',
      provider: 'stub',
      model: 'rule-based-router',
    };

    await expect(service.execute(decision, baseEvent)).resolves.toEqual({
      output: {
        skipped: true,
        reason: 'Recorded only.',
      },
    });
    expect(slackClientService.sendMessage).not.toHaveBeenCalled();
    expect(jiraClientService.createIssue).not.toHaveBeenCalled();
  });

  it('still requires a Slack channel for Slack responses', async () => {
    const service = new InternalToolExecutorService(
      {
        sendMessage: jest.fn(),
      } as unknown as SlackClientService,
      {
        createIssue: jest.fn(),
      } as unknown as JiraClientService,
    );

    const decision: WorkflowDecision = {
      action: 'respond_in_slack',
      responseText: 'Reply in thread.',
      rationale: 'This is conversational work.',
      confidence: 'medium',
      provider: 'stub',
      model: 'rule-based-router',
    };

    await expect(service.execute(decision, baseEvent)).rejects.toThrow(
      new InternalServerErrorException(
        'Slack response execution requires a target channel',
      ),
    );
  });
});