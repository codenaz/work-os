import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { isAIMessageChunk } from '@langchain/core/messages';
import { z } from 'zod';
import { CanonicalEvent } from '../events/canonical-event';
import { SettingsService } from '../settings/settings.service';
import { AiProviderFactory } from './ai-provider.factory';
import {
  isWorkflowActionSupported,
  WorkflowDecision,
  workflowActionPolicies,
} from './ai.types';

const workflowDecisionSchema = z.object({
  action: z.enum(['respond_in_slack', 'create_jira_ticket', 'skip_event']),
  responseText: z.string().min(1),
  jiraSummary: z.string().optional(),
  jiraDescription: z.string().optional(),
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
      return this.createStubDecision(event);
    }

    const configuredModel =
      await this.aiProviderFactory.createConfiguredModel();

    if (!configuredModel) {
      return this.createStubDecision(event);
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

    const normalizedText = event.content.text.toLowerCase();
    const shouldCreateTicket =
      /(bug|issue|ticket|todo|follow up|follow-up|fix)/.test(normalizedText);

    if (shouldCreateTicket) {
      return this.enforceActionPolicy(event, {
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
      });
    }

    return this.enforceActionPolicy(event, {
      action: 'respond_in_slack',
      responseText:
        'I reviewed the message and responded directly in Slack because it reads like a conversational request.',
      rationale:
        'The message does not clearly ask for durable project tracking, so Slack is the lighter-weight response.',
      confidence: 'medium',
      provider: 'stub',
      model: 'rule-based-router',
    });
  }

  private buildSystemPrompt() {
    return [
      'You are the routing brain for Work OS.',
      'You may choose exactly one action: respond_in_slack, create_jira_ticket, or skip_event.',
      'Return only valid JSON with keys action, responseText, jiraSummary, jiraDescription, rationale, confidence.',
      'respond_in_slack is only valid for Slack events that have a conversational target.',
      'skip_event is the safe choice when the current workflow should only record the event with no external action.',
      'For Jira events, prefer skip_event unless the event clearly justifies a downstream action supported by the current toolset.',
      'Use create_jira_ticket only for durable work that belongs in project tracking.',
      'Use respond_in_slack for conversational replies, acknowledgements, and low-friction responses.',
    ].join(' ');
  }

  private enforceActionPolicy(
    event: CanonicalEvent,
    decision: WorkflowDecision,
  ): WorkflowDecision {
    if (isWorkflowActionSupported(decision.action, event)) {
      return decision;
    }

    return {
      ...decision,
      action: 'skip_event',
      responseText:
        'I recorded the event without taking an external action because the requested action is not supported for this source yet.',
      jiraSummary: undefined,
      jiraDescription: undefined,
      rationale: `${decision.rationale} ${decision.action} is not supported for ${event.source} events under the current workflow policy, so the workflow was coerced to skip_event.`,
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
}
