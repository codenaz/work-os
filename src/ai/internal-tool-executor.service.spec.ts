import { InternalServerErrorException } from '@nestjs/common';
import { CanonicalEvent } from '../events/canonical-event';
import { GitHubClientService } from '../integrations/github/github-client.service';
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
    const sendMessageMock = jest.fn();
    const createIssueMock = jest.fn().mockResolvedValue({
      issueKey: 'OPS-101',
      issueUrl: 'https://jira.example.com/browse/OPS-101',
    });
    const slackClientService = {
      sendMessage: sendMessageMock,
    } as unknown as SlackClientService;
    const jiraClientService = {
      createIssue: createIssueMock,
    } as unknown as JiraClientService;
    const githubClientService = {
      createPullRequest: jest.fn(),
    } as unknown as GitHubClientService;

    const service = new InternalToolExecutorService(
      slackClientService,
      jiraClientService,
      githubClientService,
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
    expect(createIssueMock).toHaveBeenCalledWith({
      summary: 'Track follow-up work',
      description: 'Please track this follow up task',
    });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('can skip an event without invoking downstream clients', async () => {
    const sendMessageMock = jest.fn();
    const createIssueMock = jest.fn();
    const slackClientService = {
      sendMessage: sendMessageMock,
    } as unknown as SlackClientService;
    const jiraClientService = {
      createIssue: createIssueMock,
    } as unknown as JiraClientService;
    const githubClientService = {
      createPullRequest: jest.fn(),
    } as unknown as GitHubClientService;

    const service = new InternalToolExecutorService(
      slackClientService,
      jiraClientService,
      githubClientService,
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
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(createIssueMock).not.toHaveBeenCalled();
  });

  it('still requires a Slack channel for Slack responses', async () => {
    const service = new InternalToolExecutorService(
      {
        sendMessage: jest.fn(),
      } as unknown as SlackClientService,
      {
        createIssue: jest.fn(),
      } as unknown as JiraClientService,
      {
        createPullRequest: jest.fn(),
      } as unknown as GitHubClientService,
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

  it('executes create_github_pr and returns PR metadata', async () => {
    const sendMessageMock = jest.fn();
    const createIssueMock = jest.fn();
    const createPullRequestMock = jest.fn().mockResolvedValue({
      mode: 'mock',
      pullRequestNumber: 1,
      pullRequestUrl: 'https://github.com/acme/work-os/pull/1',
      branchName: 'work-os/slack/ev1',
    });
    const slackClientService = {
      sendMessage: sendMessageMock,
    } as unknown as SlackClientService;
    const jiraClientService = {
      createIssue: createIssueMock,
    } as unknown as JiraClientService;
    const githubClientService = {
      createPullRequest: createPullRequestMock,
    } as unknown as GitHubClientService;

    const service = new InternalToolExecutorService(
      slackClientService,
      jiraClientService,
      githubClientService,
    );
    const slackEvent: CanonicalEvent = {
      ...baseEvent,
      source: 'slack',
      sourceEventId: 'Ev1',
      conversation: {
        channelId: 'C123',
      },
    };

    const decision: WorkflowDecision = {
      action: 'create_github_pr',
      responseText: 'Opening a draft PR.',
      githubPrTitle: 'Add GitHub webhook support',
      githubPrBody: 'Implements GitHub webhook ingestion and safe PR routing.',
      rationale: 'Request is explicit and bounded.',
      confidence: 'medium',
      provider: 'stub',
      model: 'rule-based-router',
    };

    await expect(service.execute(decision, slackEvent)).resolves.toMatchObject({
      output: {
        pullRequest: {
          pullRequestUrl: 'https://github.com/acme/work-os/pull/1',
        },
      },
    });
    expect(createPullRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'slack',
        sourceEventId: 'Ev1',
        title: 'Add GitHub webhook support',
      }),
    );
  });
});
