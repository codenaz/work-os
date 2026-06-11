import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../../ai/ai.module';
import { EventsModule } from '../../events/events.module';
import { SettingsModule } from '../../settings/settings.module';
import { GitHubClientService } from './github-client.service';
import { GitHubController } from './github.controller';

@Module({
  imports: [SettingsModule, EventsModule, forwardRef(() => AiModule)],
  controllers: [GitHubController],
  providers: [GitHubClientService],
  exports: [GitHubClientService],
})
export class GitHubModule {}
