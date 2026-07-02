import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './environment';

@Injectable()
export class AppConfigService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  get nodeEnv() {
    return this.configService.get('NODE_ENV', { infer: true }) ?? 'development';
  }

  get port() {
    return this.configService.get('PORT', { infer: true }) ?? 3000;
  }

  get adminToken() {
    return (
      this.configService.get('ADMIN_TOKEN', { infer: true }) ??
      'work-os-local-admin'
    );
  }

  get aiMode() {
    return this.configService.get('AI_MODE', { infer: true }) ?? 'stub';
  }

  get defaultAiProvider() {
    return (
      this.configService.get('DEFAULT_AI_PROVIDER', { infer: true }) ?? 'stub'
    );
  }

  get actionExecutionMode() {
    return (
      this.configService.get('ACTION_EXECUTION_MODE', { infer: true }) ?? 'mock'
    );
  }

  get databaseUrl() {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get databaseEngine() {
    return this.databaseUrl ? 'postgres' : 'sqljs';
  }

  get openAiApiKey() {
    return this.configService.get('OPENAI_API_KEY', { infer: true });
  }

  get openAiModel() {
    return (
      this.configService.get('OPENAI_MODEL', { infer: true }) ?? 'gpt-4.1-mini'
    );
  }

  get anthropicApiKey() {
    return this.configService.get('ANTHROPIC_API_KEY', { infer: true });
  }

  get anthropicModel() {
    return (
      this.configService.get('ANTHROPIC_MODEL', { infer: true }) ??
      'claude-3-5-sonnet-latest'
    );
  }

  get slackSkipSignatureVerification() {
    return (
      this.configService.get('SLACK_SKIP_SIGNATURE_VERIFICATION', {
        infer: true,
      }) ?? false
    );
  }

  get slackBotToken() {
    return this.configService.get('SLACK_BOT_TOKEN', { infer: true });
  }

  get slackSigningSecret() {
    return this.configService.get('SLACK_SIGNING_SECRET', { infer: true });
  }

  get jiraBaseUrl() {
    return this.configService.get('JIRA_BASE_URL', { infer: true });
  }

  get jiraProjectKey() {
    return this.configService.get('JIRA_PROJECT_KEY', { infer: true });
  }

  get jiraUserEmail() {
    return this.configService.get('JIRA_USER_EMAIL', { infer: true });
  }

  get jiraApiToken() {
    return this.configService.get('JIRA_API_TOKEN', { infer: true });
  }

  get githubToken() {
    return this.configService.get('GITHUB_TOKEN', { infer: true });
  }

  get githubOwner() {
    return this.configService.get('GITHUB_OWNER', { infer: true });
  }

  get githubDefaultRepository() {
    return this.configService.get('GITHUB_DEFAULT_REPOSITORY', {
      infer: true,
    });
  }

  get githubDefaultBaseBranch() {
    return (
      this.configService.get('GITHUB_DEFAULT_BASE_BRANCH', { infer: true }) ??
      'main'
    );
  }

  get githubPrCreationEnabled() {
    return (
      this.configService.get('GITHUB_PR_CREATION_ENABLED', { infer: true }) ??
      false
    );
  }

  get githubDefaultDraftPr() {
    return (
      this.configService.get('GITHUB_DEFAULT_DRAFT_PR', { infer: true }) ?? true
    );
  }

  get githubExecutionRunner() {
    return (
      this.configService.get('GITHUB_EXECUTION_RUNNER', { infer: true }) ??
      'copilot'
    );
  }

  get claudeRemoteEnabled() {
    return (
      this.configService.get('CLAUDE_REMOTE_ENABLED', { infer: true }) ?? false
    );
  }

  get claudeCommand() {
    return (
      this.configService.get('CLAUDE_COMMAND', { infer: true }) ?? 'claude'
    );
  }

  get claudeWorkingDirectory() {
    return (
      this.configService.get('CLAUDE_WORKING_DIRECTORY', { infer: true }) ??
      '/tmp/work-os-claude'
    );
  }
}
