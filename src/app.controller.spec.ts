import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigService } from './config/app-config.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AppConfigService,
          useValue: {
            nodeEnv: 'test',
            aiMode: 'stub',
            actionExecutionMode: 'mock',
            databaseEngine: 'sqljs',
          } satisfies Partial<AppConfigService>,
        },
      ],
    }).compile();
  });

  describe('getOverview', () => {
    it('returns the service overview', () => {
      const appController = app.get(AppController);
      expect(appController.getOverview()).toEqual({
        name: 'work-os',
        description:
          'Workplace operating system foundation for Slack, Jira, GitHub, and AI workflows.',
        environment: 'test',
        modes: {
          ai: 'stub',
          actionExecution: 'mock',
          persistence: 'sqljs',
        },
        endpoints: {
          health: '/health',
          admin: '/admin',
          slackWebhook: '/webhooks/slack/events',
          jiraWebhook: '/webhooks/jira/events',
        },
      });
    });
  });
});
