import { Module } from '@nestjs/common';
import { GitHubModule } from './github/github.module';
import { JiraModule } from './jira/jira.module';
import { SlackModule } from './slack/slack.module';

@Module({
  imports: [SlackModule, JiraModule, GitHubModule],
  exports: [SlackModule, JiraModule, GitHubModule],
})
export class IntegrationsModule {}
