import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { CanonicalEvent } from '../events/canonical-event';
import { GitHubSettings, SettingsService } from '../settings/settings.service';
import { AiProviderFactory } from './ai-provider.factory';
import { isWorkflowActionSupported, WorkflowDecision } from './ai.types';

const workflowDecisionSchema = z.object({
  action: z.enum([
    'respond_in_slack',
    'create_jira_ticket',
    'create_github_pr',
    'skip_event',
  ]),
  responseText: z.string().min(1),
  jiraSummary: z.string().optional(),
  jiraDescription: z.string().optional(),
  githubPrTitle: z.string().optional(),
  githubPrBody: z.string().optional(),
  githubRepository: z.string().optional(),
  githubOwner: z.string().optional(),
  githubBaseBranch: z.string().optional(),
  githubDraft: z.boolean().optional(),
  rationale: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
});

const MIN_PR_CONTEXT_WORD_COUNT = 8;
const MIN_PR_TITLE_LENGTH = 8;
const MIN_PR_BODY_LENGTH = 24;

@Injectable()
export class AiDecisionService {
  constructor(
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly settingsService: SettingsService,
  ) {}

  async decide(event: CanonicalEvent): Promise<WorkflowDecision> {
    const [aiSettings, githubSettings] = await Promise.all([
      this.settingsService.getAiSettings(),
      this.settingsService.getGitHubSettings(),
    ]);

    if (aiSettings.mode === 'stub' || aiSettings.selectedProvider === 'stub') {
      return this.createStubDecision(event, githubSettings);
    }

    const configuredModel =
      await this.aiProviderFactory.createConfiguredModel();

    if (!configuredModel) {
      return this.createStubDecision(event, githubSettings);
    }

    const completion = await configuredModel.client.invoke([
      new SystemMessage(this.buildSystemPrompt()),
      new HumanMessage(
        JSON.stringify(
          {
            event,
            githubSettings: {
              owner: githubSettings.owner,
              defaultRepository: githubSettings.defaultRepository,
              defaultBaseBranch: githubSettings.defaultBaseBranch,
              prCreationEnabled: githubSettings.prCreationEnabled,
              defaultDraftPullRequest: githubSettings.defaultDraftPullRequest,
              configured: githubSettings.configured,
            },
          },
          null,
          2,
        ),
      ),
    ]);
    const rawText = this.extractText(completion.content);
    const parsed = workflowDecisionSchema.parse(
      this.extractJsonObject(rawText),
    );

    return this.enforceActionPolicy(
      event,
      {
        ...parsed,
        provider: configuredModel.provider,
        model: configuredModel.model,
      },
      githubSettings,
    );
  }

  private createStubDecision(
    event: CanonicalEvent,
    githubSettings: GitHubSettings,
  ): WorkflowDecision {
    const normalizedText = event.content.text.toLowerCase();
    const asksForPullRequest =
      /(pull request|create pr|open pr|github pr|raise pr)/.test(
        normalizedText,
      );
    const hasClearTask =
      /(implement|add|fix|update|refactor|cleanup|clean up|support|build|migrate)/.test(
        normalizedText,
      );
    const hasEnoughDetail =
      normalizedText.split(/\s+/).filter(Boolean).length >=
      MIN_PR_CONTEXT_WORD_COUNT;

    if (asksForPullRequest) {
      const hasSafeConfiguration =
        githubSettings.prCreationEnabled && githubSettings.configured;
      if (hasSafeConfiguration && hasClearTask && hasEnoughDetail) {
        return this.enforceActionPolicy(
          event,
          {
            action: 'create_github_pr',
            responseText:
              'I prepared a GitHub pull request to execute the requested change with a bounded implementation plan.',
            githubPrTitle: this.summarizeForGitHubTitle(event.content.text),
            githubPrBody: this.buildDefaultPrBody(event),
            githubRepository: githubSettings.defaultRepository,
            githubOwner: githubSettings.owner,
            githubBaseBranch: githubSettings.defaultBaseBranch,
            githubDraft: githubSettings.defaultDraftPullRequest,
            rationale:
              'The request explicitly asks for a pull request and includes enough implementation detail to create a bounded change safely.',
            confidence: 'medium',
            provider: 'stub',
            model: 'rule-based-router',
          },
          githubSettings,
        );
      }

      return {
        action: 'skip_event',
        responseText:
          'I recorded the event but skipped pull request creation because the request lacks safe context or GitHub PR creation settings are incomplete.',
        rationale:
          'Autonomous PR creation is conservative and requires explicit configuration plus clear, bounded implementation context.',
        confidence: 'high',
        provider: 'stub',
        model: 'rule-based-router',
      };
    }

    if (event.source !== 'slack') {
      return {
        action: 'skip_event',
        responseText:
          'I recorded the event without taking an external action because this source is not wired for automated follow-up yet.',
        rationale:
          'Non-Slack events are currently ingested for observability and later expansion, but the MVP action set should not create loops or side effects by default.',
        confidence: 'high',
        provider: 'stub',
        model: 'rule-based-router',
      };
    }

    const shouldCreateTicket =
      /(bug|issue|ticket|todo|follow up|follow-up|fix)/.test(normalizedText);

    if (shouldCreateTicket) {
      return this.enforceActionPolicy(
        event,
        {
          action: 'create_jira_ticket',
          responseText:
            'I turned that Slack request into a Jira task and posted the tracking link here.',
          jiraSummary: this.summarizeForJira(event.content.text),
          jiraDescription: event.content.text,
          rationale:
            'The message looks like actionable work that should be tracked in Jira.',
          confidence: 'medium',
          provider: 'stub',
          model: 'rule-based-router',
        },
        githubSettings,
      );
    }

    return this.enforceActionPolicy(
      event,
      {
        action: 'respond_in_slack',
        responseText:
          'I reviewed the message and responded directly in Slack because it reads like a conversational request.',
        rationale:
          'The message does not clearly ask for durable project tracking, so Slack is the lighter-weight response.',
        confidence: 'medium',
        provider: 'stub',
        model: 'rule-based-router',
      },
      githubSettings,
    );
  }

  private buildSystemPrompt() {
    return [
      'You are the routing brain for Work OS.',
      'You may choose exactly one action: respond_in_slack, create_jira_ticket, create_github_pr, or skip_event.',
      'Return only valid JSON with keys action, responseText, jiraSummary, jiraDescription, githubPrTitle, githubPrBody, githubRepository, githubOwner, githubBaseBranch, githubDraft, rationale, confidence.',
      'respond_in_slack is only valid for Slack events that have a conversational target.',
      'create_github_pr is only valid for Slack or Jira events and only when context is sufficient for safe bounded execution.',
      'skip_event is the safe choice when context is weak, unsafe, or configuration is incomplete.',
      'Prefer draft pull requests unless confidence is high and bounded implementation context is explicit.',
    ].join(' ');
  }

  private enforceActionPolicy(
    event: CanonicalEvent,
    decision: WorkflowDecision,
    githubSettings: GitHubSettings,
  ): WorkflowDecision {
    if (!isWorkflowActionSupported(decision.action, event)) {
      return this.asSkipDecision(
        decision,
        `Requested action ${decision.action} is not supported for ${event.source} events.`,
      );
    }

    if (decision.action === 'create_github_pr') {
      const title = decision.githubPrTitle?.trim() ?? '';
      const body = decision.githubPrBody?.trim() ?? '';
      const hasEnoughContext =
        title.length >= MIN_PR_TITLE_LENGTH &&
        body.length >= MIN_PR_BODY_LENGTH;
      const hasConfiguration =
        githubSettings.configured && githubSettings.prCreationEnabled;

      if (!hasEnoughContext || !hasConfiguration) {
        return this.asSkipDecision(
          decision,
          'GitHub PR creation requires explicit repository configuration and sufficiently detailed PR title/body context.',
        );
      }
    }

    return decision;
  }

  private asSkipDecision(
    decision: WorkflowDecision,
    reason: string,
  ): WorkflowDecision {
    return {
      ...decision,
      action: 'skip_event',
      responseText:
        'I recorded the event without taking an external action because the requested action is not supported or safe with the current context.',
      jiraSummary: undefined,
      jiraDescription: undefined,
      githubPrTitle: undefined,
      githubPrBody: undefined,
      githubRepository: undefined,
      githubOwner: undefined,
      githubBaseBranch: undefined,
      githubDraft: undefined,
      rationale: `${decision.rationale} ${reason}`,
    };
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (!Array.isArray(content)) {
      return '';
    }

    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (this.hasContent(part)) {
          return this.extractText(part.content);
        }

        if (this.hasText(part)) {
          return part.text;
        }

        return '';
      })
      .join('\n');
  }

  private hasText(value: unknown): value is { text: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'text' in value &&
      typeof value.text === 'string'
    );
  }

  private hasContent(value: unknown): value is { content: unknown } {
    return typeof value === 'object' && value !== null && 'content' in value;
  }

  private extractJsonObject(value: string) {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new InternalServerErrorException(
        'AI decision did not return a parseable JSON object',
      );
    }

    return JSON.parse(value.slice(start, end + 1)) as unknown;
  }

  private summarizeForJira(text: string) {
    const summary = this.sanitizePlainText(text);

    return summary.slice(0, 120) || 'Slack follow-up';
  }

  private summarizeForGitHubTitle(text: string) {
    const summary = this.sanitizePlainText(text);
    return summary.slice(0, 100) || 'Work OS requested change';
  }

  private buildDefaultPrBody(event: CanonicalEvent) {
    return [
      '## Why',
      event.content.text,
      '',
      '## Implementation plan',
      '- Review the impacted modules and affected workflows',
      '- Implement the requested change with conservative scope',
      '- Add or update tests for regression coverage',
      '',
      '## Source event',
      `- Source: ${event.source}`,
      `- Event ID: ${event.sourceEventId}`,
    ].join('\n');
  }

  private sanitizePlainText(value: string) {
    let result = '';
    let inTag = false;
    let previousWasWhitespace = false;

    for (const char of value) {
      if (char === '<') {
        inTag = true;
        continue;
      }

      if (char === '>' && inTag) {
        inTag = false;
        continue;
      }

      if (inTag) {
        continue;
      }

      const isWhitespace = /\s/.test(char);
      if (isWhitespace) {
        if (!previousWasWhitespace) {
          result += ' ';
          previousWasWhitespace = true;
        }
        continue;
      }

      previousWasWhitespace = false;
      result += char;
    }

    return result.trim();
  }
}
