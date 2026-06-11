import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../../ai/ai.module';
import { EventsModule } from '../../events/events.module';
import { SettingsModule } from '../../settings/settings.module';
import { JiraClientService } from './jira-client.service';
import { JiraController } from './jira.controller';

@Module({
  imports: [SettingsModule, EventsModule, forwardRef(() => AiModule)],
  controllers: [JiraController],
  providers: [JiraClientService],
  exports: [JiraClientService],
})
export class JiraModule {}
