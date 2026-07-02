import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  HumanMessage,
  isAIMessageChunk,
  SystemMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { CanonicalEvent } from '../events/canonical-event';
import { SettingsService } from '../settings/settings.service';
import { AiProviderFactory } from './ai-provider.factory';
import {
  GitHubExecutionRunner,
  isWorkflowActionSupported,
  WorkflowDecision,
} from './ai.types';

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
  githubRepositoryOwner: z.string().optional(),
  githubExecutionRunner: z.enum(['copilot', 'claude']).optional(),
  githubPrTitle: z.string().optional(),
  githubPrBody: z.string().optional(),
  githubRepository: z.string().optional(),
  githubBaseBranch: z.string().optional(),
  githubDraft: z.boolean().optional(),
  rationale: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
});

const MIN_GITHUB_PR_CONTEXT_LENGTH = 40;
const FALLBACK_GITHUB_PR_CONTEXT_LENGTH = 60;
const JIRA_SUMMARY_MAX_LENGTH = 120;
const GITHUB_TITLE_MAX_LENGTH = 80;

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
            githubExecution: {
              defaultRunner: githubSettings.executionRunner,
              copilotEnabled: githubSettings.prCreationEnabled,
              claudeEnabled: githubSettings.claudeRemoteEnabled,
              defaultRepository: githubSettings.defaultRepository,
              defaultBaseBranch: githubSettings.defaultBaseBranch,
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
          'I prepared a conservative remote coding task with a bounded prompt to capture the request.',
        githubPrTitle: this.summarizeForGitHub(event.content.text),
        githubPrBody: this.buildGitHubBody(event.content.text),
        githubDraft: true,
        rationale:
          'The request explicitly asks for a GitHub PR and includes enough detail to hand off a bounded coding task safely.',
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
      'Return only valid JSON with keys action, responseText, jiraSummary, jiraDescription, githubRepositoryOwner, githubExecutionRunner, githubPrTitle, githubPrBody, githubRepository, githubBaseBranch, githubDraft, rationale, confidence.',
      'respond_in_slack is only valid for Slack events that have a conversational target.',
      'create_github_pr is only valid for Slack and Jira events and requires enough context for a bounded change request.',
      'If create_github_pr is selected, choose githubExecutionRunner as either copilot or claude based on the available execution options provided in the input.',
      'Never choose create_github_pr for GitHub-originated events to avoid loop behavior.',
      'skip_event is the safe choice when context or configuration is insufficient.',
    ].join(' ');
  }

  private async enforceActionPolicy(
    event: CanonicalEvent,
    decision: WorkflowDecision,
  ): Promise<WorkflowDecision> {
    if (!isWorkflowActionSupported(decision.action, event)) {
      return this.toSkipDecision(
        event,
        decision,
        `${decision.action} is not supported for ${event.source} events under the current workflow policy.`,
      );
    }

    if (decision.action === 'create_github_pr') {
      const resolvedTarget = await this.resolveGitHubTarget(event, decision);

      if (!resolvedTarget) {
        return this.toSkipDecision(
          event,
          decision,
          'GitHub PR creation requires a resolvable repository target from explicit context or configured defaults.',
        );
      }

      const enrichedDecision = {
        ...decision,
        githubRepositoryOwner: resolvedTarget.owner,
        githubExecutionRunner: resolvedTarget.runner,
        githubRepository: resolvedTarget.repository,
        githubBaseBranch:
          decision.githubBaseBranch ?? resolvedTarget.baseBranch,
        githubDraft: decision.githubDraft ?? resolvedTarget.defaultDraftPr,
      };

      const hasEnoughContext = this.hasEnoughContextForGitHubPr(
        event,
        enrichedDecision,
      );
      if (!hasEnoughContext) {
        return this.toSkipDecision(
          event,
          decision,
          'GitHub PR creation requires explicit, bounded context and clear implementation intent.',
        );
      }

      return enrichedDecision;
    }

    return decision;
  }

  private async resolveGitHubTarget(
    event: CanonicalEvent,
    decision: WorkflowDecision,
  ) {
    const githubSettings = await this.settingsService.getGitHubSettings();
    const runner = this.resolveGitHubExecutionRunner(decision, githubSettings);

    if (!runner) {
      return null;
    }

    const directDecisionTarget = this.normalizeRepositoryTarget(
      decision.githubRepositoryOwner,
      decision.githubRepository,
    );

    if (directDecisionTarget) {
      return {
        ...directDecisionTarget,
        runner,
        baseBranch: decision.githubBaseBranch,
        defaultDraftPr: decision.githubDraft ?? true,
      };
    }

    const eventTarget = this.extractRepositoryTarget(event.content.text);
    if (eventTarget) {
      return {
        ...eventTarget,
        runner,
        baseBranch: decision.githubBaseBranch,
        defaultDraftPr: decision.githubDraft ?? true,
      };
    }

    if (githubSettings.owner && githubSettings.defaultRepository) {
      return {
        owner: githubSettings.owner,
        repository: githubSettings.defaultRepository,
        runner,
        baseBranch: githubSettings.defaultBaseBranch ?? 'main',
        defaultDraftPr: githubSettings.defaultDraftPr,
      };
    }

    return null;
  }

  private resolveGitHubExecutionRunner(
    decision: WorkflowDecision,
    githubSettings: Awaited<ReturnType<SettingsService['getGitHubSettings']>>,
  ): GitHubExecutionRunner | null {
    const preferredRunner =
      decision.githubExecutionRunner ?? githubSettings.executionRunner;

    if (preferredRunner === 'claude') {
      return githubSettings.claudeRemoteEnabled ? 'claude' : null;
    }

    return githubSettings.prCreationEnabled ? 'copilot' : null;
  }

  private hasEnoughContextForGitHubPr(
    event: CanonicalEvent,
    decision: WorkflowDecision,
  ) {
    if (!['slack', 'jira'].includes(event.source)) {
      return false;
    }

    const text = event.content.text.trim();
    if (text.length < MIN_GITHUB_PR_CONTEXT_LENGTH) {
      return false;
    }

    const hasActionVerb =
      /(implement|add|update|fix|refactor|migrate|create|build)/i.test(text);
    const hasScopeMarker =
      /\b(api|controller|service|module|test|ui|dashboard|webhook|workflow|settings|github|jira|slack)\b/i.test(
        text,
      );

    return (
      hasActionVerb &&
      hasScopeMarker &&
      Boolean(decision.githubRepositoryOwner) &&
      Boolean(decision.githubRepository) &&
      Boolean(decision.githubExecutionRunner) &&
      Boolean(
        decision.githubPrTitle?.trim() ||
          text.length >= FALLBACK_GITHUB_PR_CONTEXT_LENGTH,
      )
    );
  }

  private extractRepositoryTarget(text: string) {
    const repoUrlMatch = text.match(
      /https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i,
    );
    if (repoUrlMatch) {
      return {
        owner: repoUrlMatch[1],
        repository: repoUrlMatch[2].replace(/\.git$/i, ''),
      };
    }

    const repoHintMatch = text.match(
      /\b(?:repo|repository)\s+([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/i,
    );
    if (repoHintMatch) {
      return {
        owner: repoHintMatch[1],
        repository: repoHintMatch[2],
      };
    }

    return null;
  }

  private normalizeRepositoryTarget(owner?: string, repository?: string) {
    if (owner && repository) {
      return {
        owner: owner.trim(),
        repository: repository.trim(),
      };
    }

    if (!repository) {
      return null;
    }

    const trimmedRepository = repository.trim();
    const fullNameMatch = trimmedRepository.match(
      /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/,
    );

    if (!fullNameMatch) {
      return null;
    }

    return {
      owner: fullNameMatch[1],
      repository: fullNameMatch[2],
    };
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
      githubRepositoryOwner: undefined,
      githubExecutionRunner: undefined,
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
    const summary = this.normalizePlainText(text);

    return summary.slice(0, JIRA_SUMMARY_MAX_LENGTH) || 'Slack follow-up';
  }

  private summarizeForGitHub(text: string) {
    const summary = this.normalizePlainText(text);

    return (
      summary.slice(0, GITHUB_TITLE_MAX_LENGTH) ||
      'Work OS automated change request'
    );
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

  private normalizePlainText(text: string) {
    return text
      .replaceAll('<', ' ')
      .replaceAll('>', ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
