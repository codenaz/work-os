import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HumanMessage, isAIMessageChunk, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { CanonicalEvent } from '../events/canonical-event';
import { SettingsService } from '../settings/settings.service';
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
  githubBaseBranch: z.string().optional(),
  githubDraft: z.boolean().optional(),
  rationale: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
});

@Injectable()
export class AiDecisionService {
  constructor(
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly settingsService: SettingsService,
  ) {}

  async decide(event: CanonicalEvent): Promise<WorkflowDecision> {
    const aiSettings = await this.settingsService.getAiSettings();

    if (aiSettings.mode === 'stub' || aiSettings.selectedProvider === 'stub') {
      const stubDecision = this.createStubDecision(event);
      return this.enforceActionPolicy(event, stubDecision);
    }

    const configuredModel =
      await this.aiProviderFactory.createConfiguredModel();

    if (!configuredModel) {
      const fallbackDecision = this.createStubDecision(event);
      return this.enforceActionPolicy(event, fallbackDecision);
    }

    const completion = await configuredModel.client.invoke([
      new SystemMessage(this.buildSystemPrompt()),
      new HumanMessage(
        JSON.stringify(
          {
            event,
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

    return this.enforceActionPolicy(event, {
      ...parsed,
      provider: configuredModel.provider,
      model: configuredModel.model,
    });
  }

  private createStubDecision(event: CanonicalEvent): WorkflowDecision {
    const normalizedText = event.content.text.toLowerCase();
    const shouldCreateTicket =
      event.source === 'slack' &&
      /(bug|issue|ticket|todo|follow up|follow-up|fix)/.test(normalizedText);

    if (shouldCreateTicket) {
      return {
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
      };
    }

    const shouldCreateGitHubPr =
      ['slack', 'jira'].includes(event.source) &&
      /(pull request|\bpr\b|github pr|open pr|create pr|implement|ship this)/.test(
        normalizedText,
      );

    if (shouldCreateGitHubPr) {
      return {
        action: 'create_github_pr',
        responseText:
          'I prepared a conservative GitHub draft PR with a bounded scaffold to capture the request.',
        githubPrTitle: this.summarizeForGitHub(event.content.text),
        githubPrBody: this.buildGitHubBody(event.content.text),
        githubDraft: true,
        rationale:
          'The request explicitly asks for a GitHub PR and includes enough detail to open a bounded draft safely.',
        confidence: 'medium',
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

    return {
      action: 'respond_in_slack',
      responseText:
        'I reviewed the message and responded directly in Slack because it reads like a conversational request.',
      rationale:
        'The message does not clearly ask for durable project tracking or repository changes, so Slack is the lighter-weight response.',
      confidence: 'medium',
      provider: 'stub',
      model: 'rule-based-router',
    };
  }

  private buildSystemPrompt() {
    return [
      'You are the routing brain for Work OS.',
      'You may choose exactly one action: respond_in_slack, create_jira_ticket, create_github_pr, or skip_event.',
      'Return only valid JSON with keys action, responseText, jiraSummary, jiraDescription, githubPrTitle, githubPrBody, githubRepository, githubBaseBranch, githubDraft, rationale, confidence.',
      'respond_in_slack is only valid for Slack events that have a conversational target.',
      'create_github_pr is only valid for Slack and Jira events and requires enough context for a bounded change request.',
      'Never choose create_github_pr for GitHub-originated events to avoid loop behavior.',
      'skip_event is the safe choice when context or configuration is insufficient.',
    ].join(' ');
  }

  private enforceActionPolicy(
    event: CanonicalEvent,
    decision: WorkflowDecision,
  ): WorkflowDecision {
    if (!isWorkflowActionSupported(decision.action, event)) {
      return this.toSkipDecision(event, decision, `${decision.action} is not supported for ${event.source} events under the current workflow policy.`);
    }

    if (decision.action === 'create_github_pr') {
      const hasEnoughContext = this.hasEnoughContextForGitHubPr(event, decision);
      if (!hasEnoughContext) {
        return this.toSkipDecision(
          event,
          decision,
          'GitHub PR creation requires explicit, bounded context and clear implementation intent.',
        );
      }
    }

    return decision;
  }

  private hasEnoughContextForGitHubPr(
    event: CanonicalEvent,
    decision: WorkflowDecision,
  ) {
    if (!['slack', 'jira'].includes(event.source)) {
      return false;
    }

    const text = event.content.text.trim();
    if (text.length < 40) {
      return false;
    }

    const hasActionVerb =
      /(implement|add|update|fix|refactor|migrate|create|build)/i.test(text);
    const hasScopeMarker = /\b(api|controller|service|module|test|ui|dashboard|webhook|workflow|settings|github|jira|slack)\b/i.test(
      text,
    );

    return (
      hasActionVerb &&
      hasScopeMarker &&
      Boolean(decision.githubPrTitle?.trim() || text.length >= 60)
    );
  }

  private toSkipDecision(
    event: CanonicalEvent,
    decision: WorkflowDecision,
    reason: string,
  ): WorkflowDecision {
    return {
      ...decision,
      action: 'skip_event',
      responseText:
        'I recorded the event without taking an external action because the request lacked enough safe context for autonomous execution.',
      jiraSummary: undefined,
      jiraDescription: undefined,
      githubPrTitle: undefined,
      githubPrBody: undefined,
      githubRepository: undefined,
      githubBaseBranch: undefined,
      githubDraft: undefined,
      rationale: `${decision.rationale} ${reason}`,
      confidence: event.source === 'github' ? 'high' : decision.confidence,
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

        if (isAIMessageChunk(part)) {
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
    const summary = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return summary.slice(0, 120) || 'Slack follow-up';
  }

  private summarizeForGitHub(text: string) {
    const summary = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return summary.slice(0, 80) || 'Work OS automated change request';
  }

  private buildGitHubBody(text: string) {
    return [
      '## Summary',
      text,
      '',
      '## Plan',
      '- [ ] Confirm requirements and repository target',
      '- [ ] Implement bounded code changes',
      '- [ ] Validate with lint, tests, and build',
    ].join('\n');
  }
}
