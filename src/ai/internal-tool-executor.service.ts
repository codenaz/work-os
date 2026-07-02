import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CanonicalEvent } from '../events/canonical-event';
import { ClaudeCodeService } from '../integrations/github/claude-code.service';
import { GitHubClientService } from '../integrations/github/github-client.service';
import { JiraClientService } from '../integrations/jira/jira-client.service';
import { SlackClientService } from '../integrations/slack/slack-client.service';
import { WorkflowDecision } from './ai.types';

@Injectable()
export class InternalToolExecutorService {
  constructor(
    private readonly slackClientService: SlackClientService,
    private readonly jiraClientService: JiraClientService,
    private readonly githubClientService: GitHubClientService,
    private readonly claudeCodeService: ClaudeCodeService,
  ) {}

  async execute(decision: WorkflowDecision, event: CanonicalEvent) {
    const channelId = event.conversation?.channelId;

    if (decision.action === 'skip_event') {
      return {
        output: {
          skipped: true,
          reason: decision.responseText,
        },
      };
    }

    if (decision.action === 'respond_in_slack') {
      if (!channelId) {
        throw new InternalServerErrorException(
          'Slack response execution requires a target channel',
        );
      }

      const slackResponse = await this.slackClientService.sendMessage({
        channelId,
        text: decision.responseText,
        threadTs: event.conversation?.threadTs,
      });

      return {
        output: {
          slackResponse,
        },
      };
    }

    if (decision.action === 'create_jira_ticket') {
      const jiraIssue = await this.jiraClientService.createIssue({
        summary: decision.jiraSummary ?? 'Slack follow-up',
        description: decision.jiraDescription ?? event.content.text,
      });

      const slackResponse = channelId
        ? await this.slackClientService.sendMessage({
            channelId,
            text: `${decision.responseText} Jira issue: ${jiraIssue.issueKey}`,
            threadTs: event.conversation?.threadTs,
          })
        : null;

      return {
        output: {
          jiraIssue,
          ...(slackResponse ? { slackResponse } : {}),
        },
      };
    }

    const executionParams = {
      title:
        decision.githubPrTitle ??
        event.content.text.slice(0, 80) ??
        'Work OS automated change request',
      body:
        decision.githubPrBody ??
        `Automated request captured from ${event.source} event ${event.sourceEventId}.`,
      owner: decision.githubRepositoryOwner,
      repository: decision.githubRepository,
      baseBranch: decision.githubBaseBranch,
      draft: decision.githubDraft,
    };

    const githubExecution =
      decision.githubExecutionRunner === 'claude'
        ? await this.claudeCodeService.startRemoteTask(executionParams)
        : await this.githubClientService.startCopilotTask(executionParams);

    const slackMessage =
      decision.githubExecutionRunner === 'claude'
        ? `${decision.responseText} Claude remote run started for ${githubExecution.owner}/${githubExecution.repository} in ${'workingDirectory' in githubExecution ? githubExecution.workingDirectory : 'the configured working directory'}.`
        : `${decision.responseText} Copilot task ${'taskId' in githubExecution ? githubExecution.taskId : 'unknown'} is ${'taskState' in githubExecution ? githubExecution.taskState : 'queued'}.${'taskUrl' in githubExecution && githubExecution.taskUrl ? ` ${githubExecution.taskUrl}` : ''}`;

    const slackResponse = channelId
      ? await this.slackClientService.sendMessage({
          channelId,
          text: slackMessage,
          threadTs: event.conversation?.threadTs,
        })
      : null;

    return {
      output: {
        githubExecution,
        ...(slackResponse ? { slackResponse } : {}),
      },
    };
  }
}
