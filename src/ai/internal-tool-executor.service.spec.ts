import { InternalServerErrorException } from '@nestjs/common';
import { CanonicalEvent } from '../events/canonical-event';
import { ClaudeCodeService } from '../integrations/github/claude-code.service';
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
    const sendMessage = jest.fn();
    const createIssue = jest.fn().mockResolvedValue({
      issueKey: 'OPS-101',
      issueUrl: 'https://jira.example.com/browse/OPS-101',
    });

    const service = new InternalToolExecutorService(
      { sendMessage } as unknown as SlackClientService,
      { createIssue } as unknown as JiraClientService,
      { startCopilotTask: jest.fn() } as unknown as GitHubClientService,
      { startRemoteTask: jest.fn() } as unknown as ClaudeCodeService,
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
    expect(createIssue).toHaveBeenCalledWith({
      summary: 'Track follow-up work',
      description: 'Please track this follow up task',
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('starts a Copilot task for create_github_pr actions', async () => {
    const startCopilotTask = jest.fn().mockResolvedValue({
      mode: 'mock',
      owner: 'codenaz',
      repository: 'work-os',
      taskId: 'task-7',
      taskState: 'queued',
      taskUrl: 'https://github.com/codenaz/work-os/copilot/tasks/task-7',
    });

    const service = new InternalToolExecutorService(
      { sendMessage: jest.fn() } as unknown as SlackClientService,
      { createIssue: jest.fn() } as unknown as JiraClientService,
      { startCopilotTask } as unknown as GitHubClientService,
      { startRemoteTask: jest.fn() } as unknown as ClaudeCodeService,
    );

    const decision: WorkflowDecision = {
      action: 'create_github_pr',
      responseText: 'Created draft PR.',
      githubExecutionRunner: 'copilot',
      githubPrTitle: 'Implement webhook support',
      githubPrBody: '## Summary\nAdd webhook support.',
      githubRepository: 'work-os',
      githubBaseBranch: 'main',
      githubDraft: true,
      rationale: 'Request is implementation-ready.',
      confidence: 'high',
      provider: 'stub',
      model: 'rule-based-router',
    };

    await expect(service.execute(decision, baseEvent)).resolves.toEqual({
      output: {
        githubExecution: {
          mode: 'mock',
          owner: 'codenaz',
          repository: 'work-os',
          taskId: 'task-7',
          taskState: 'queued',
          taskUrl: 'https://github.com/codenaz/work-os/copilot/tasks/task-7',
        },
      },
    });

    expect(startCopilotTask).toHaveBeenCalledWith({
      title: 'Implement webhook support',
      body: '## Summary\nAdd webhook support.',
      owner: undefined,
      repository: 'work-os',
      baseBranch: 'main',
      draft: true,
    });
  });

  it('starts a Claude remote task when the decision chooses claude', async () => {
    const startRemoteTask = jest.fn().mockResolvedValue({
      mode: 'mock',
      runner: 'claude',
      owner: 'codenaz',
      repository: 'work-os',
      baseBranch: 'main',
      workingDirectory: '/tmp/work-os-claude/mock-claude-1',
      output: 'Claude remote task queued in mock mode.',
    });

    const service = new InternalToolExecutorService(
      { sendMessage: jest.fn() } as unknown as SlackClientService,
      { createIssue: jest.fn() } as unknown as JiraClientService,
      { startCopilotTask: jest.fn() } as unknown as GitHubClientService,
      { startRemoteTask } as unknown as ClaudeCodeService,
    );

    const decision: WorkflowDecision = {
      action: 'create_github_pr',
      responseText: 'Started Claude remote run.',
      githubExecutionRunner: 'claude',
      githubRepositoryOwner: 'codenaz',
      githubPrTitle: 'Implement webhook support',
      githubPrBody: '## Summary\nAdd webhook support.',
      githubRepository: 'work-os',
      githubBaseBranch: 'main',
      githubDraft: true,
      rationale: 'Request is implementation-ready.',
      confidence: 'high',
      provider: 'stub',
      model: 'rule-based-router',
    };

    await expect(service.execute(decision, baseEvent)).resolves.toEqual({
      output: {
        githubExecution: {
          mode: 'mock',
          runner: 'claude',
          owner: 'codenaz',
          repository: 'work-os',
          baseBranch: 'main',
          workingDirectory: '/tmp/work-os-claude/mock-claude-1',
          output: 'Claude remote task queued in mock mode.',
        },
      },
    });

    expect(startRemoteTask).toHaveBeenCalledWith({
      title: 'Implement webhook support',
      body: '## Summary\nAdd webhook support.',
      owner: 'codenaz',
      repository: 'work-os',
      baseBranch: 'main',
      draft: true,
    });
  });

  it('can skip an event without invoking downstream clients', async () => {
    const sendMessage = jest.fn();
    const createIssue = jest.fn();
    const startCopilotTask = jest.fn();

    const service = new InternalToolExecutorService(
      { sendMessage } as unknown as SlackClientService,
      { createIssue } as unknown as JiraClientService,
      { startCopilotTask } as unknown as GitHubClientService,
      { startRemoteTask: jest.fn() } as unknown as ClaudeCodeService,
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
    expect(sendMessage).not.toHaveBeenCalled();
    expect(createIssue).not.toHaveBeenCalled();
    expect(startCopilotTask).not.toHaveBeenCalled();
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
        startCopilotTask: jest.fn(),
      } as unknown as GitHubClientService,
      {
        startRemoteTask: jest.fn(),
      } as unknown as ClaudeCodeService,
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
