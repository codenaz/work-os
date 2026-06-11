import { Module } from '@nestjs/common';
import { SettingsModule } from '../../settings/settings.module';
import { GitHubClientService } from './github-client.service';

@Module({
  imports: [SettingsModule],
  providers: [GitHubClientService],
  exports: [GitHubClientService],
})
export class GitHubModule {}
