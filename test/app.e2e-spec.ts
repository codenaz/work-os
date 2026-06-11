import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.SLACK_SKIP_SIGNATURE_VERIFICATION = 'true';
    const { AppModule } = require('./../src/app.module') as typeof import('./../src/app.module');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        environment: 'test',
        modes: {
          persistence: 'sqljs',
          ai: 'stub',
          selectedProvider: 'stub',
          actionExecution: 'mock',
        },
        integrations: {
          slack: false,
          jira: false,
          github: false,
        },
      });
  });

  it('/webhooks/slack/events (POST) returns the Slack challenge', () => {
    return request(app.getHttpServer())
      .post('/webhooks/slack/events')
      .send({
        type: 'url_verification',
        challenge: 'abc123',
      })
      .expect(201)
      .expect({
        challenge: 'abc123',
      });
  });

  it('/webhooks/jira/events (POST) accepts a Jira issue webhook', () => {
    return request(app.getHttpServer())
      .post('/webhooks/jira/events')
      .set('x-atlassian-webhook-identifier', 'jira-delivery-e2e')
      .send({
        webhookEvent: 'jira:issue_updated',
        timestamp: 1717171717000,
        user: {
          accountId: 'acct-123',
          displayName: 'Pat',
        },
        issue: {
          id: '10001',
          key: 'OPS-12',
          fields: {
            summary: 'Investigate latency spike',
            description: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Customer reports point to checkout latency.',
                    },
                  ],
                },
              ],
            },
          },
        },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.status).toBe('skipped');
        expect(body.eventId).toBe('jira-delivery-e2e');
        expect(typeof body.workflowRunId).toBe('string');
      });
  });
});
