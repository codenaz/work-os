import { Injectable } from '@nestjs/common';
import { JiraWebhookDto } from '../integrations/jira/dto/jira-webhook.dto';
import { SlackEventEnvelopeDto } from '../integrations/slack/dto/slack-event-envelope.dto';
import { CanonicalEvent } from './canonical-event';

@Injectable()
export class CanonicalEventService {
  getJiraSourceEventId(payload: JiraWebhookDto, deliveryId?: string) {
    if (deliveryId) {
      return deliveryId;
    }

    const issueId = payload.issue?.id ?? 'unknown-issue';
    const commentId = payload.comment?.id ?? 'no-comment';
    const timestamp = payload.timestamp ?? payload.issue?.fields?.updated ?? 'no-timestamp';

    return [payload.webhookEvent, issueId, commentId, String(timestamp)].join(':');
  }

  fromSlackEvent(payload: SlackEventEnvelopeDto): CanonicalEvent | null {
    if (payload.type !== 'event_callback' || !payload.event || !payload.event_id) {
      return null;
    }

    if (!this.isSupportedSlackEvent(payload)) {
      return null;
    }

    const threadTs = payload.event.thread_ts ?? payload.event.ts;
    const text = payload.event.text?.trim() ?? '';

    return {
      source: 'slack',
      sourceEventId: payload.event_id,
      eventType: payload.event.type,
      idempotencyKey: `slack:${payload.event_id}`,
      correlationId: payload.event_id,
      receivedAt: new Date(
        (payload.event_time ?? Math.floor(Date.now() / 1000)) * 1000,
      ).toISOString(),
      actor: {
        id: payload.event.user,
      },
      conversation: {
        channelId: payload.event.channel,
        messageTs: payload.event.ts,
        threadTs,
      },
      content: {
        text,
      },
      raw: payload as unknown as Record<string, unknown>,
    };
  }

  fromJiraEvent(payload: JiraWebhookDto, deliveryId?: string): CanonicalEvent | null {
    if (!this.isSupportedJiraEvent(payload) || !payload.issue?.id) {
      return null;
    }

    const sourceEventId = this.getJiraSourceEventId(payload, deliveryId);
    const summary = payload.issue.fields?.summary?.trim() ?? payload.issue.key ?? 'Jira event';
    const issueDescription = this.extractText(payload.issue.fields?.description);
    const commentText = this.extractText(payload.comment?.body);
    const text = [summary, issueDescription, commentText]
      .filter((value) => value.length > 0)
      .join('\n\n')
      .trim();

    return {
      source: 'jira',
      sourceEventId,
      eventType: payload.webhookEvent,
      idempotencyKey: `jira:${sourceEventId}`,
      correlationId: payload.issue.id,
      receivedAt: new Date(payload.timestamp ?? Date.now()).toISOString(),
      actor: {
        id: payload.user?.accountId,
        displayName: payload.user?.displayName,
      },
      content: {
        text: text || summary,
      },
      raw: payload as unknown as Record<string, unknown>,
    };
  }

  private isSupportedSlackEvent(payload: SlackEventEnvelopeDto) {
    if (!payload.event) {
      return false;
    }

    if (payload.event.bot_id || payload.event.subtype === 'bot_message') {
      return false;
    }

    if (payload.event.type === 'app_mention') {
      return true;
    }

    return payload.event.type === 'message' && payload.event.channel_type === 'im';
  }

  private isSupportedJiraEvent(payload: JiraWebhookDto) {
    return ['jira:issue_created', 'jira:issue_updated', 'comment_created'].includes(
      payload.webhookEvent,
    );
  }

  private extractText(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.extractText(entry)).filter(Boolean).join(' ');
    }

    if (!value || typeof value !== 'object') {
      return '';
    }

    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }

    if ('content' in value && Array.isArray(value.content)) {
      return value.content
        .map((entry) => this.extractText(entry))
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    return '';
  }
}
