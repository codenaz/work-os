import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../../ai/ai.module';
import { EventsModule } from '../../events/events.module';
import { SettingsModule } from '../../settings/settings.module';
import { SlackController } from './slack.controller';
import { SlackClientService } from './slack-client.service';
import { SlackSignatureService } from './slack-signature.service';

@Module({
  imports: [SettingsModule, EventsModule, forwardRef(() => AiModule)],
  controllers: [SlackController],
  providers: [SlackClientService, SlackSignatureService],
  exports: [SlackClientService, SlackSignatureService],
})
export class SlackModule {}
