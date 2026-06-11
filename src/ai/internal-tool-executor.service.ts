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

    const githubPullRequest = await this.githubClientService.createPullRequest({
      title:
        decision.githubPrTitle ??
        event.content.text.slice(0, 80) ??
        'Work OS automated change request',
      body:
        decision.githubPrBody ??
        `Automated request captured from ${event.source} event ${event.sourceEventId}.`,
      repository: decision.githubRepository,
      baseBranch: decision.githubBaseBranch,
      draft: decision.githubDraft,
    });

    const slackResponse = channelId
      ? await this.slackClientService.sendMessage({
          channelId,
          text: `${decision.responseText} PR: ${githubPullRequest.pullRequestUrl}`,
          threadTs: event.conversation?.threadTs,
        })
      : null;

    return {
      output: {
        githubPullRequest,
        ...(slackResponse ? { slackResponse } : {}),
      },
    };
  }
}
