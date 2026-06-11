import { JiraWebhookDto } from '../integrations/jira/dto/jira-webhook.dto';
import { SlackEventEnvelopeDto } from '../integrations/slack/dto/slack-event-envelope.dto';
import { CanonicalEventService } from './canonical-event.service';

describe('CanonicalEventService', () => {
  const service = new CanonicalEventService();

  it('normalizes supported Slack mention events', () => {
    const event = service.fromSlackEvent({
      type: 'event_callback',
      event_id: 'Ev123',
      event_time: 1_717_171_717,
      event: {
        type: 'app_mention',
        user: 'U123',
        text: 'Please create a ticket for this bug',
        channel: 'C123',
        ts: '1717171717.000100',
      },
    } satisfies SlackEventEnvelopeDto);

    expect(event).toEqual({
      source: 'slack',
      sourceEventId: 'Ev123',
      eventType: 'app_mention',
      idempotencyKey: 'slack:Ev123',
      correlationId: 'Ev123',
      receivedAt: '2024-05-31T16:08:37.000Z',
      actor: {
        id: 'U123',
      },
      conversation: {
        channelId: 'C123',
        messageTs: '1717171717.000100',
        threadTs: '1717171717.000100',
      },
      content: {
        text: 'Please create a ticket for this bug',
      },
      raw: {
        type: 'event_callback',
        event_id: 'Ev123',
        event_time: 1_717_171_717,
        event: {
          type: 'app_mention',
          user: 'U123',
          text: 'Please create a ticket for this bug',
          channel: 'C123',
          ts: '1717171717.000100',
        },
      },
    });
  });

  it('ignores unsupported Slack events', () => {
    expect(
      service.fromSlackEvent({
        type: 'event_callback',
        event_id: 'Ev456',
        event_time: 1_717_171_718,
        event: {
          type: 'reaction_added',
        },
      } satisfies SlackEventEnvelopeDto),
    ).toBeNull();
  });

  it('normalizes supported Jira issue events', () => {
    const event = service.fromJiraEvent(
      {
        webhookEvent: 'jira:issue_updated',
        timestamp: 1_717_171_717_000,
        user: {
          accountId: 'acct-123',
          displayName: 'Pat',
        },
        issue: {
          id: '10001',
          key: 'OPS-12',
          fields: {
            summary: 'Checkout flow is timing out',
            description: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Production users are hitting timeouts.',
                    },
                  ],
                },
              ],
            },
          },
        },
      } satisfies JiraWebhookDto,
      'jira-delivery-1',
    );

    expect(event).toEqual({
      source: 'jira',
      sourceEventId: 'jira-delivery-1',
      eventType: 'jira:issue_updated',
      idempotencyKey: 'jira:jira-delivery-1',
      correlationId: '10001',
      receivedAt: '2024-05-31T16:08:37.000Z',
      actor: {
        id: 'acct-123',
        displayName: 'Pat',
      },
      content: {
        text: 'Checkout flow is timing out\n\nProduction users are hitting timeouts.',
      },
      raw: {
        webhookEvent: 'jira:issue_updated',
        timestamp: 1_717_171_717_000,
        user: {
          accountId: 'acct-123',
          displayName: 'Pat',
        },
        issue: {
          id: '10001',
          key: 'OPS-12',
          fields: {
            summary: 'Checkout flow is timing out',
            description: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Production users are hitting timeouts.',
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    });
  });
});
