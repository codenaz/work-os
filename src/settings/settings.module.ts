import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationConnectionEntity } from '../database/entities/integration-connection.entity';
import { ProviderCredentialEntity } from '../database/entities/provider-credential.entity';
import { WorkspaceSettingEntity } from '../database/entities/workspace-setting.entity';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceSettingEntity,
      ProviderCredentialEntity,
      IntegrationConnectionEntity,
    ]),
  ],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
