import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { JiraTicketMappingEntity } from '../database/entities/jira-ticket-mapping.entity';
import { WorkflowRunEntity } from '../database/entities/workflow-run.entity';
import { EventsModule } from '../events/events.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SettingsModule } from '../settings/settings.module';
import { AiDecisionService } from './ai-decision.service';
import { AiProviderFactory } from './ai-provider.factory';
import { InternalToolExecutorService } from './internal-tool-executor.service';
import { WorkflowOrchestratorService } from './workflow-orchestrator.service';

@Module({
  imports: [
    SettingsModule,
    EventsModule,
    TypeOrmModule.forFeature([
      WorkflowRunEntity,
      AuditLogEntity,
      JiraTicketMappingEntity,
    ]),
    forwardRef(() => IntegrationsModule),
  ],
  providers: [
    AiProviderFactory,
    AiDecisionService,
    InternalToolExecutorService,
    WorkflowOrchestratorService,
  ],
  exports: [WorkflowOrchestratorService],
})
export class AiModule {}
