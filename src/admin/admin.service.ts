import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowRunEntity } from '../database/entities/workflow-run.entity';
import { InboundEventsService } from '../events/inbound-events.service';
import { HealthService } from '../health/health.service';
import { SettingsService } from '../settings/settings.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { UpdateGitHubSettingsDto } from './dto/update-github-settings.dto';
import { UpdateJiraSettingsDto } from './dto/update-jira-settings.dto';
import { UpdateModesDto } from './dto/update-modes.dto';
import { UpdateSlackSettingsDto } from './dto/update-slack-settings.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly inboundEventsService: InboundEventsService,
    private readonly healthService: HealthService,
    @InjectRepository(WorkflowRunEntity)
    private readonly workflowRunsRepository: Repository<WorkflowRunEntity>,
  ) {}

  async getDashboardData() {
    const [
      health,
      aiSettings,
      slackSettings,
      jiraSettings,
      githubSettings,
      actionExecutionMode,
      recentEvents,
      recentRuns,
    ] = await Promise.all([
      this.healthService.getHealthSummary(),
      this.settingsService.getAiSettings(),
      this.settingsService.getSlackSettings(),
      this.settingsService.getJiraSettings(),
      this.settingsService.getGitHubSettings(),
      this.settingsService.getActionExecutionMode(),
      this.inboundEventsService.getRecentEvents(),
      this.getRecentWorkflowRuns(),
    ]);

    return {
      health,
      aiSettings,
      actionExecutionMode,
      slackSettings: {
        configured: slackSettings.configured,
        botTokenConfigured: Boolean(slackSettings.botToken),
        signingSecretConfigured: Boolean(slackSettings.signingSecret),
      },
      jiraSettings: {
        configured: jiraSettings.configured,
        baseUrl: jiraSettings.baseUrl ?? '',
        projectKey: jiraSettings.projectKey ?? '',
        userEmail: jiraSettings.userEmail ?? '',
        apiTokenConfigured: Boolean(jiraSettings.apiToken),
      },
      githubSettings: {
        configured: githubSettings.configured,
        tokenConfigured: Boolean(githubSettings.token),
      },
      recentEvents,
      recentRuns,
    };
  }

  async updateModes(dto: UpdateModesDto) {
    await Promise.all([
      this.settingsService.setSelectedAiProvider(dto.selectedAiProvider),
      this.settingsService.setActionExecutionMode(dto.actionExecutionMode),
    ]);
  }

  async updateAiSettings(dto: UpdateAiSettingsDto) {
    if (dto.selectedAiProvider) {
      await this.settingsService.setSelectedAiProvider(dto.selectedAiProvider);
    }

    await Promise.all([
      this.settingsService.upsertProviderCredential(
        'openai',
        this.filterEmpty({
          apiKey: dto.openAiApiKey,
        }),
        this.filterEmpty({
          model: dto.openAiModel,
        }),
      ),
      this.settingsService.upsertProviderCredential(
        'anthropic',
        this.filterEmpty({
          apiKey: dto.anthropicApiKey,
        }),
        this.filterEmpty({
          model: dto.anthropicModel,
        }),
      ),
    ]);
  }

  async updateSlackSettings(dto: UpdateSlackSettingsDto) {
    const mergedSecrets = this.filterEmpty({
      botToken: dto.botToken,
      signingSecret: dto.signingSecret,
    });

    await this.settingsService.upsertProviderCredential('slack', mergedSecrets);
    const slackSettings = await this.settingsService.getSlackSettings();
    await this.settingsService.upsertIntegrationConnection(
      'slack',
      slackSettings.configured ? 'connected' : 'needs-config',
      {},
    );
  }

  async updateJiraSettings(dto: UpdateJiraSettingsDto) {
    await Promise.all([
      this.settingsService.upsertProviderCredential(
        'jira',
        this.filterEmpty({
          apiToken: dto.apiToken,
        }),
        this.filterEmpty({
          userEmail: dto.userEmail,
        }),
      ),
      this.settingsService.upsertIntegrationConnection(
        'jira',
        'needs-config',
        this.filterEmpty({
          baseUrl: dto.baseUrl,
          projectKey: dto.projectKey,
        }),
      ),
    ]);

    const jiraSettings = await this.settingsService.getJiraSettings();
    await this.settingsService.upsertIntegrationConnection(
      'jira',
      jiraSettings.configured ? 'connected' : 'needs-config',
      this.filterEmpty({
        baseUrl: dto.baseUrl,
        projectKey: dto.projectKey,
      }),
    );
  }

  async updateGitHubSettings(dto: UpdateGitHubSettingsDto) {
    await this.settingsService.upsertProviderCredential(
      'github',
      this.filterEmpty({
        token: dto.token,
      }),
    );
    const githubSettings = await this.settingsService.getGitHubSettings();
    await this.settingsService.upsertIntegrationConnection(
      'github',
      githubSettings.configured ? 'connected' : 'needs-config',
      {},
    );
  }

  async getRecentWorkflowRuns(limit = 10) {
    return this.workflowRunsRepository.find({
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }

  private filterEmpty(values: Record<string, string | undefined>) {
    return Object.fromEntries(
      Object.entries(values).filter(([, value]) => value?.trim()),
    );
  }
}
