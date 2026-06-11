import { Injectable } from '@nestjs/common';
import { AppConfigService } from './config/app-config.service';

@Injectable()
export class AppService {
  constructor(private readonly appConfigService: AppConfigService) {}

  getOverview() {
    return {
      name: 'work-os',
      description:
        'Workplace operating system foundation for Slack, Jira, GitHub, and AI workflows.',
      environment: this.appConfigService.nodeEnv,
      modes: {
        ai: this.appConfigService.aiMode,
        actionExecution: this.appConfigService.actionExecutionMode,
        persistence: this.appConfigService.databaseEngine,
      },
      endpoints: {
        health: '/health',
        admin: '/admin',
        slackWebhook: '/webhooks/slack/events',
        jiraWebhook: '/webhooks/jira/events',
        githubWebhook: '/webhooks/github/events',
      },
    };
  }
}
