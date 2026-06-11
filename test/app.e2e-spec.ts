import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import * as hbs from 'hbs';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.SLACK_SKIP_SIGNATURE_VERIFICATION = 'true';
    process.env.ADMIN_TOKEN = 'work-os-local-admin';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication<NestExpressApplication>();
    nestApp.setBaseViewsDir(join(__dirname, '..', 'views'));
    nestApp.setViewEngine('hbs');
    nestApp.useStaticAssets(join(__dirname, '..', 'public'));
    hbs.registerPartials(join(__dirname, '..', 'views', 'partials'));
    nestApp.use(cookieParser());
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app = nestApp;
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
      .expect(({ body }: { body: { integrations: { github: boolean } } }) => {
        expect(body.status).toBe('ok');
        expect(body.environment).toBe('test');
        expect(body.modes).toEqual({
          persistence: 'sqljs',
          ai: 'stub',
          selectedProvider: 'stub',
          actionExecution: 'mock',
        });
        expect(typeof body.integrations.github).toBe('boolean');
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
      .expect(({ body }: { body: { ok: boolean; status: string; eventId: string; workflowRunId: string } }) => {
        expect(body.ok).toBe(true);
        expect(body.status).toBe('skipped');
        expect(body.eventId).toBe('jira-delivery-e2e');
        expect(typeof body.workflowRunId).toBe('string');
      });
  });

  it('/webhooks/github/events (POST) ingests a supported GitHub webhook', () => {
    return request(app.getHttpServer())
      .post('/webhooks/github/events')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'gh-delivery-e2e')
      .send({
        action: 'opened',
        pull_request: {
          number: 11,
          title: 'Implement GitHub webhook pipeline support',
          body: 'Please wire canonical event support and conservative policy.',
          user: {
            login: 'codenaz',
          },
        },
      })
      .expect(201)
      .expect(({ body }: { body: { ok: boolean; status: string; eventId: string; workflowRunId: string } }) => {
        expect(body.ok).toBe(true);
        expect(body.status).toBe('skipped');
        expect(body.eventId).toBe('gh-delivery-e2e');
        expect(typeof body.workflowRunId).toBe('string');
      });
  });

  it('/admin (GET) renders login page and HTMX partials continue to work', async () => {
    const agent = request.agent(app.getHttpServer());

    const loginPage = await agent.get('/admin').expect(200);
    expect(loginPage.text).toContain('<form method="post" action="/admin/login"');

    await agent
      .post('/admin/login')
      .type('form')
      .send({ token: 'work-os-local-admin' })
      .expect(302);

    const partial = await agent.get('/admin/partials/events').expect(200);
    expect(partial.text).toMatch(
      /(No inbound events have been received yet\.)|(<ul class=\"list\">)/,
    );
  });
});
