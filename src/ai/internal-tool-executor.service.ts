import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CanonicalEvent } from '../events/canonical-event';
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
  ) {}

  async execute(
    decision: WorkflowDecision,
    event: CanonicalEvent,
  ): Promise<{ output: Record<string, unknown> }> {
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

    if (decision.action === 'create_github_pr') {
      if (event.source !== 'slack' && event.source !== 'jira') {
        throw new InternalServerErrorException(
          'GitHub PR creation is only supported for Slack and Jira events',
        );
      }

      const pullRequest = await this.githubClientService.createPullRequest({
        source: event.source,
        sourceEventId: event.sourceEventId,
        taskText: event.content.text,
        title: decision.githubPrTitle ?? 'Work OS change request',
        body: decision.githubPrBody ?? event.content.text,
        owner: decision.githubOwner,
        repository: decision.githubRepository,
        baseBranch: decision.githubBaseBranch,
        draft: decision.githubDraft,
      });

      const slackResponse =
        event.source === 'slack' && channelId
          ? await this.slackClientService.sendMessage({
              channelId,
              text: `${decision.responseText} PR: ${pullRequest.pullRequestUrl}`,
              threadTs: event.conversation?.threadTs,
            })
          : null;

      return {
        output: {
          pullRequest,
          ...(slackResponse ? { slackResponse } : {}),
        },
      };
    }

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
}
