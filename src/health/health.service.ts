import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  async getHealthSummary() {
    const [aiSettings, slackSettings, jiraSettings, githubSettings, actionMode] =
      await Promise.all([
        this.settingsService.getAiSettings(),
        this.settingsService.getSlackSettings(),
        this.settingsService.getJiraSettings(),
        this.settingsService.getGitHubSettings(),
        this.settingsService.getActionExecutionMode(),
      ]);

    return {
      status: 'ok',
      environment: this.appConfigService.nodeEnv,
      modes: {
        persistence: this.appConfigService.databaseEngine,
        ai: aiSettings.mode,
        selectedProvider: aiSettings.selectedProvider,
        actionExecution: actionMode,
      },
      integrations: {
        slack: slackSettings.configured,
        jira: jiraSettings.configured,
        github: githubSettings.configured,
      },
    };
  }
}
