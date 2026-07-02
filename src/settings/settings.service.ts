import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../config/app-config.service';
import { IntegrationConnectionEntity } from '../database/entities/integration-connection.entity';
import { ProviderCredentialEntity } from '../database/entities/provider-credential.entity';
import { WorkspaceSettingEntity } from '../database/entities/workspace-setting.entity';

export type ActionExecutionMode = 'mock' | 'live';
export type SupportedAiProvider = 'stub' | 'openai' | 'anthropic';

export interface AiSettings {
  selectedProvider: SupportedAiProvider;
  mode: 'stub' | 'live';
  openAiModel: string;
  openAiApiKeyConfigured: boolean;
  anthropicModel: string;
  anthropicApiKeyConfigured: boolean;
}

export interface SlackSettings {
  botToken?: string;
  signingSecret?: string;
  configured: boolean;
}

export interface JiraSettings {
  baseUrl?: string;
  projectKey?: string;
  userEmail?: string;
  apiToken?: string;
  configured: boolean;
}

export interface GitHubSettings {
  token?: string;
  owner?: string;
  defaultRepository?: string;
  defaultBaseBranch?: string;
  executionRunner: 'copilot' | 'claude';
  prCreationEnabled: boolean;
  defaultDraftPr: boolean;
  claudeRemoteEnabled: boolean;
  claudeCommand: string;
  claudeWorkingDirectory: string;
  configured: boolean;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(WorkspaceSettingEntity)
    private readonly workspaceSettingsRepository: Repository<WorkspaceSettingEntity>,
    @InjectRepository(ProviderCredentialEntity)
    private readonly providerCredentialsRepository: Repository<ProviderCredentialEntity>,
    @InjectRepository(IntegrationConnectionEntity)
    private readonly integrationConnectionsRepository: Repository<IntegrationConnectionEntity>,
    private readonly appConfigService: AppConfigService,
  ) {}

  async getWorkspaceSetting(key: string) {
    const setting = await this.workspaceSettingsRepository.findOneBy({ key });
    return setting?.value;
  }

  async setWorkspaceSetting(key: string, value: string) {
    await this.workspaceSettingsRepository.save({
      key,
      value,
    });
  }

  async getProviderCredential(provider: string) {
    return this.providerCredentialsRepository.findOneBy({ provider });
  }

  async upsertProviderCredential(
    provider: string,
    secretData: Record<string, string>,
    metadata: Record<string, string> = {},
  ) {
    const existing = await this.providerCredentialsRepository.findOneBy({
      provider,
    });

    await this.providerCredentialsRepository.save({
      provider,
      authType: existing?.authType ?? 'api-key',
      secretData: {
        ...(existing?.secretData ?? {}),
        ...secretData,
      },
      metadata: {
        ...(existing?.metadata ?? {}),
        ...metadata,
      },
    });
  }

  async getIntegrationConnection(provider: string) {
    return this.integrationConnectionsRepository.findOneBy({ provider });
  }

  async upsertIntegrationConnection(
    provider: string,
    status: 'connected' | 'needs-config' | 'disabled',
    config: Record<string, string>,
  ) {
    const existing = await this.integrationConnectionsRepository.findOneBy({
      provider,
    });

    await this.integrationConnectionsRepository.save({
      provider,
      status,
      config: {
        ...(existing?.config ?? {}),
        ...config,
      },
    });
  }

  async getActionExecutionMode(): Promise<ActionExecutionMode> {
    const persistedMode = await this.getWorkspaceSetting('actionExecutionMode');
    return (
      (persistedMode as ActionExecutionMode | undefined) ??
      this.appConfigService.actionExecutionMode
    );
  }

  async setActionExecutionMode(mode: ActionExecutionMode) {
    await this.setWorkspaceSetting('actionExecutionMode', mode);
  }

  async getSelectedAiProvider(): Promise<SupportedAiProvider> {
    const persistedProvider =
      await this.getWorkspaceSetting('selectedAiProvider');
    return (
      (persistedProvider as SupportedAiProvider | undefined) ??
      this.appConfigService.defaultAiProvider
    );
  }

  async setSelectedAiProvider(provider: SupportedAiProvider) {
    await this.setWorkspaceSetting('selectedAiProvider', provider);
  }

  async getAiSettings(): Promise<AiSettings> {
    const openAiCredential = await this.getProviderCredential('openai');
    const anthropicCredential = await this.getProviderCredential('anthropic');

    return {
      selectedProvider: await this.getSelectedAiProvider(),
      mode: this.appConfigService.aiMode,
      openAiModel:
        openAiCredential?.metadata?.model ?? this.appConfigService.openAiModel,
      openAiApiKeyConfigured: Boolean(
        openAiCredential?.secretData?.apiKey ??
        this.appConfigService.openAiApiKey,
      ),
      anthropicModel:
        anthropicCredential?.metadata?.model ??
        this.appConfigService.anthropicModel,
      anthropicApiKeyConfigured: Boolean(
        anthropicCredential?.secretData?.apiKey ??
        this.appConfigService.anthropicApiKey,
      ),
    };
  }

  async getSlackSettings(): Promise<SlackSettings> {
    const slackCredential = await this.getProviderCredential('slack');
    const botToken =
      slackCredential?.secretData?.botToken ??
      this.appConfigService.slackBotToken;
    const signingSecret =
      slackCredential?.secretData?.signingSecret ??
      this.appConfigService.slackSigningSecret;

    return {
      botToken,
      signingSecret,
      configured: Boolean(botToken && signingSecret),
    };
  }

  async getJiraSettings(): Promise<JiraSettings> {
    const jiraCredential = await this.getProviderCredential('jira');
    const jiraConnection = await this.getIntegrationConnection('jira');
    const baseUrl =
      jiraConnection?.config?.baseUrl ?? this.appConfigService.jiraBaseUrl;
    const projectKey =
      jiraConnection?.config?.projectKey ??
      this.appConfigService.jiraProjectKey;
    const userEmail =
      jiraCredential?.metadata?.userEmail ??
      this.appConfigService.jiraUserEmail;
    const apiToken =
      jiraCredential?.secretData?.apiToken ??
      this.appConfigService.jiraApiToken;

    return {
      baseUrl,
      projectKey,
      userEmail,
      apiToken,
      configured: Boolean(baseUrl && projectKey && userEmail && apiToken),
    };
  }

  async getGitHubSettings(): Promise<GitHubSettings> {
    const githubCredential = await this.getProviderCredential('github');
    const githubConnection = await this.getIntegrationConnection('github');
    const token =
      githubCredential?.secretData?.token ?? this.appConfigService.githubToken;
    const owner =
      githubConnection?.config?.owner ?? this.appConfigService.githubOwner;
    const defaultRepository =
      githubConnection?.config?.defaultRepository ??
      this.appConfigService.githubDefaultRepository;
    const defaultBaseBranch =
      githubConnection?.config?.defaultBaseBranch ??
      this.appConfigService.githubDefaultBaseBranch;
    const executionRunnerSetting = await this.getWorkspaceSetting(
      'githubExecutionRunner',
    );

    const prCreationEnabledSetting = await this.getWorkspaceSetting(
      'githubPrCreationEnabled',
    );
    const defaultDraftPrSetting = await this.getWorkspaceSetting(
      'githubDefaultDraftPr',
    );
    const claudeRemoteEnabledSetting = await this.getWorkspaceSetting(
      'claudeRemoteEnabled',
    );
    const claudeCommandSetting = await this.getWorkspaceSetting(
      'claudeCommand',
    );
    const claudeWorkingDirectorySetting = await this.getWorkspaceSetting(
      'claudeWorkingDirectory',
    );

    const executionRunner =
      executionRunnerSetting === 'claude' ? 'claude' : 'copilot';

    const prCreationEnabled =
      prCreationEnabledSetting === undefined
        ? this.appConfigService.githubPrCreationEnabled
        : prCreationEnabledSetting === 'true';
    const defaultDraftPr =
      defaultDraftPrSetting === undefined
        ? this.appConfigService.githubDefaultDraftPr
        : defaultDraftPrSetting === 'true';
    const claudeRemoteEnabled =
      claudeRemoteEnabledSetting === undefined
        ? this.appConfigService.claudeRemoteEnabled
        : claudeRemoteEnabledSetting === 'true';
    const claudeCommand =
      claudeCommandSetting ?? this.appConfigService.claudeCommand;
    const claudeWorkingDirectory =
      claudeWorkingDirectorySetting ??
      this.appConfigService.claudeWorkingDirectory;

    return {
      token,
      owner,
      defaultRepository,
      defaultBaseBranch,
      executionRunner,
      prCreationEnabled,
      defaultDraftPr,
      claudeRemoteEnabled,
      claudeCommand,
      claudeWorkingDirectory,
      configured: Boolean(token && owner && defaultRepository),
    };
  }

  async setGitHubExecutionRunner(runner: 'copilot' | 'claude') {
    await this.setWorkspaceSetting('githubExecutionRunner', runner);
  }

  async setGitHubPrCreationEnabled(enabled: boolean) {
    await this.setWorkspaceSetting('githubPrCreationEnabled', String(enabled));
  }

  async setGitHubDefaultDraftPr(enabled: boolean) {
    await this.setWorkspaceSetting('githubDefaultDraftPr', String(enabled));
  }

  async setClaudeRemoteEnabled(enabled: boolean) {
    await this.setWorkspaceSetting('claudeRemoteEnabled', String(enabled));
  }

  async setClaudeCommand(command: string) {
    await this.setWorkspaceSetting('claudeCommand', command);
  }

  async setClaudeWorkingDirectory(directory: string) {
    await this.setWorkspaceSetting('claudeWorkingDirectory', directory);
  }
}
