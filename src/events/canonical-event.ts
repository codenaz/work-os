export interface CanonicalEventActor {
  id?: string;
  displayName?: string;
}

export interface CanonicalEventConversation {
  channelId?: string;
  threadTs?: string;
  messageTs?: string;
}

export interface CanonicalEvent {
  source: 'slack' | 'jira' | 'github';
  sourceEventId: string;
  eventType: string;
  idempotencyKey: string;
  correlationId: string;
  receivedAt: string;
  actor: CanonicalEventActor;
  conversation?: CanonicalEventConversation;
  content: {
    text: string;
  };
  raw: Record<string, unknown>;
}
