import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApplication } from '../src/app.bootstrap';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.SLACK_SKIP_SIGNATURE_VERIFICATION = 'true';

    const appModule =
      require('./../src/app.module') as typeof import('./../src/app.module'); // eslint-disable-line @typescript-eslint/no-require-imports

    const moduleFixture = await Test.createTestingModule({
      imports: [appModule.AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApplication(app);
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
      .expect(
        ({
          body,
        }: {
          body: {
            status: string;
            environment: string;
            modes: Record<string, string>;
            integrations: Record<string, boolean>;
          };
        }) => {
          expect(body.status).toBe('ok');
          expect(body.environment).toBe('test');
          expect(body.modes).toEqual({
            persistence: 'sqljs',
            ai: 'stub',
            selectedProvider: 'stub',
            actionExecution: 'mock',
          });
          expect(typeof body.integrations.slack).toBe('boolean');
          expect(typeof body.integrations.jira).toBe('boolean');
          expect(typeof body.integrations.github).toBe('boolean');
        },
      );
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
      .expect(
        ({
          body,
        }: {
          body: {
            ok: boolean;
            status: string;
            eventId: string;
            workflowRunId: string;
          };
        }) => {
          expect(body.ok).toBe(true);
          expect(body.status).toBe('skipped');
          expect(body.eventId).toBe('jira-delivery-e2e');
          expect(typeof body.workflowRunId).toBe('string');
        },
      );
  });

  it('/webhooks/github/events (POST) accepts a GitHub webhook', () => {
    return request(app.getHttpServer())
      .post('/webhooks/github/events')
      .set('x-github-delivery', 'github-delivery-e2e')
      .send({
        eventType: 'issue_comment',
        action: 'created',
        repository: {
          full_name: 'acme/work-os',
          name: 'work-os',
          owner: {
            login: 'acme',
          },
        },
        issue: {
          number: 12,
          title: 'Implement webhook support',
          body: 'Need GitHub webhook ingress.',
        },
        comment: {
          body: 'Please create a follow-up implementation plan.',
        },
        sender: {
          login: 'pat',
        },
      })
      .expect(201)
      .expect(
        ({
          body,
        }: {
          body: {
            ok: boolean;
            status: string;
            eventId: string;
            workflowRunId: string;
          };
        }) => {
          expect(body.ok).toBe(true);
          expect(body.status).toBe('skipped');
          expect(body.eventId).toBe('github-delivery-e2e');
          expect(typeof body.workflowRunId).toBe('string');
        },
      );
  });

  it('/admin (GET) renders the Handlebars login page', () => {
    return request(app.getHttpServer())
      .get('/admin')
      .expect(200)
      .expect(({ text }: { text: string }) => {
        expect(text).toContain('<form method="post" action="/admin/login"');
        expect(text).toContain('<link rel="stylesheet" href="/admin.css"');
      });
  });

  it('/admin/partials/events (GET) still serves HTMX partial HTML', () => {
    return request(app.getHttpServer())
      .get('/admin/partials/events')
      .set('Cookie', ['work_os_admin_session=work-os-local-admin'])
      .expect(200)
      .expect(({ text }: { text: string }) => {
        expect(text).toMatch(
          /<ul class="list">|No inbound events have been received yet\./,
        );
      });
  });
});
