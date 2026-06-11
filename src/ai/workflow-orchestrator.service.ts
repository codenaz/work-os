import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { InboundEventEntity } from '../database/entities/inbound-event.entity';
import { JiraTicketMappingEntity } from '../database/entities/jira-ticket-mapping.entity';
import { WorkflowRunEntity } from '../database/entities/workflow-run.entity';
import { CanonicalEvent } from '../events/canonical-event';
import { InboundEventsService } from '../events/inbound-events.service';
import { AiDecisionService } from './ai-decision.service';
import { InternalToolExecutorService } from './internal-tool-executor.service';

@Injectable()
export class WorkflowOrchestratorService {
  constructor(
    @InjectRepository(WorkflowRunEntity)
    private readonly workflowRunsRepository: Repository<WorkflowRunEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogsRepository: Repository<AuditLogEntity>,
    @InjectRepository(JiraTicketMappingEntity)
    private readonly jiraTicketMappingsRepository: Repository<JiraTicketMappingEntity>,
    private readonly inboundEventsService: InboundEventsService,
    private readonly aiDecisionService: AiDecisionService,
    private readonly internalToolExecutorService: InternalToolExecutorService,
  ) {}

  async processCanonicalEvent(
    sourceEvent: InboundEventEntity,
    canonicalEvent: CanonicalEvent,
  ) {
    const workflowRun = await this.workflowRunsRepository.save({
      sourceEventId: sourceEvent.id,
      source: canonicalEvent.source,
      status: 'queued',
      inputSummary: canonicalEvent.content.text.slice(0, 240),
    });

    try {
      const decision = await this.aiDecisionService.decide(canonicalEvent);
      const executionResult = await this.internalToolExecutorService.execute(
        decision,
        canonicalEvent,
      );
      const workflowStatus =
        decision.action === 'skip_event' ? 'skipped' : 'completed';

      const completedRun = await this.workflowRunsRepository.save({
        ...workflowRun,
        provider: decision.provider,
        model: decision.model,
        action: decision.action,
        status: workflowStatus,
        output: executionResult.output,
        errorMessage: null,
      });

      if ('jiraIssue' in executionResult.output) {
        const jiraIssue = executionResult.output.jiraIssue as {
          issueKey: string;
          issueUrl: string;
        };

        await this.jiraTicketMappingsRepository.save({
          workflowRunId: completedRun.id,
          sourceEventId: sourceEvent.id,
          issueKey: jiraIssue.issueKey,
          issueUrl: jiraIssue.issueUrl,
          summary: decision.jiraSummary ?? canonicalEvent.content.text,
        });
      }

      await this.auditLogsRepository.save({
        actor: 'workflow-orchestrator',
        action: decision.action,
        status: 'succeeded',
        entityType: 'workflow_run',
        entityId: completedRun.id,
        details: executionResult.output,
      });
      await this.inboundEventsService.markProcessed(
        sourceEvent.id,
        canonicalEvent,
        executionResult.output,
      );

      return completedRun;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown workflow execution error';

      await this.workflowRunsRepository.save({
        ...workflowRun,
        status: 'failed',
        errorMessage: message,
      });
      await this.auditLogsRepository.save({
        actor: 'workflow-orchestrator',
        action: 'workflow_failed',
        status: 'failed',
        entityType: 'workflow_run',
        entityId: workflowRun.id,
        details: {
          message,
        },
      });
      await this.inboundEventsService.markFailed(sourceEvent.id, message);

      throw error;
    }
  }
}
