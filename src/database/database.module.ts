import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/app-config.service';
import { AuditLogEntity } from './entities/audit-log.entity';
import { InboundEventEntity } from './entities/inbound-event.entity';
import { IntegrationConnectionEntity } from './entities/integration-connection.entity';
import { JiraTicketMappingEntity } from './entities/jira-ticket-mapping.entity';
import { ProviderCredentialEntity } from './entities/provider-credential.entity';
import { WorkflowRunEntity } from './entities/workflow-run.entity';
import { WorkspaceSettingEntity } from './entities/workspace-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => {
        if (appConfigService.databaseUrl) {
          return {
            type: 'postgres' as const,
            url: appConfigService.databaseUrl,
            autoLoadEntities: true,
            synchronize: true,
          };
        }

        return {
          type: 'sqljs' as const,
          autoLoadEntities: true,
          synchronize: true,
          autoSave: false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      WorkspaceSettingEntity,
      ProviderCredentialEntity,
      IntegrationConnectionEntity,
      InboundEventEntity,
      WorkflowRunEntity,
      AuditLogEntity,
      JiraTicketMappingEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
