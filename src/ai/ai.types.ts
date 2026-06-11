import { CanonicalEvent } from '../events/canonical-event';
import { SupportedAiProvider } from '../settings/settings.service';

export type WorkflowAction =
  | 'respond_in_slack'
  | 'create_jira_ticket'
  | 'skip_event';

export interface WorkflowActionPolicy {
  supportedSources: CanonicalEvent['source'][];
  requiresConversationTarget: boolean;
}

export const workflowActionPolicies: Record<WorkflowAction, WorkflowActionPolicy> = {
  respond_in_slack: {
    supportedSources: ['slack'],
    requiresConversationTarget: true,
  },
  create_jira_ticket: {
    supportedSources: ['slack', 'github'],
    requiresConversationTarget: false,
  },
  skip_event: {
    supportedSources: ['slack', 'jira', 'github'],
    requiresConversationTarget: false,
  },
};

export function isWorkflowActionSupported(
  action: WorkflowAction,
  event: CanonicalEvent,
) {
  const policy = workflowActionPolicies[action];

  if (!policy.supportedSources.includes(event.source)) {
    return false;
  }

  if (policy.requiresConversationTarget) {
    return Boolean(event.conversation?.channelId);
  }

  return true;
}

export interface WorkflowDecision {
  action: WorkflowAction;
  responseText: string;
  jiraSummary?: string;
  jiraDescription?: string;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
  provider: SupportedAiProvider;
  model: string;
}
