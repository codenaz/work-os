import { Body, Controller, Headers, Post } from '@nestjs/common';
import { WorkflowOrchestratorService } from '../../ai/workflow-orchestrator.service';
import { CanonicalEventService } from '../../events/canonical-event.service';
import { InboundEventsService } from '../../events/inbound-events.service';
import { GitHubWebhookDto } from './dto/github-webhook.dto';

@Controller('webhooks/github')
export class GitHubController {
  constructor(
    private readonly canonicalEventService: CanonicalEventService,
    private readonly inboundEventsService: InboundEventsService,
    private readonly workflowOrchestratorService: WorkflowOrchestratorService,
  ) {}

  @Post('events')
  async handleEvents(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: GitHubWebhookDto,
  ) {
    const deliveryId = this.getHeader(headers, 'x-github-delivery');
    const externalEventId = this.canonicalEventService.getGitHubSourceEventId(
      body,
      deliveryId,
    );
    const canonicalEvent = this.canonicalEventService.fromGitHubEvent(
      body,
      deliveryId,
    );
    const recordedEvent = await this.inboundEventsService.recordReceivedEvent({
      source: 'github',
      eventType: body.eventType,
      externalEventId,
      idempotencyKey: `github:${externalEventId}`,
      correlationId: body.repository.full_name,
      payload: body as unknown as Record<string, unknown>,
      canonicalEvent,
    });

    if (!recordedEvent.created) {
      return {
        ok: true,
        duplicate: true,
        status: recordedEvent.event.status,
        eventId: externalEventId,
      };
    }

    if (!canonicalEvent) {
      await this.inboundEventsService.markIgnored(
        recordedEvent.event.id,
        'GitHub webhook event type is not handled by the current MVP policy',
      );

      return {
        ok: true,
        status: 'ignored',
        eventId: externalEventId,
      };
    }

    try {
      const workflowRun =
        await this.workflowOrchestratorService.processCanonicalEvent(
          recordedEvent.event,
          canonicalEvent,
        );

      return {
        ok: true,
        status: workflowRun.status,
        eventId: externalEventId,
        workflowRunId: workflowRun.id,
      };
    } catch (error) {
      return {
        ok: true,
        status: 'failed',
        eventId: externalEventId,
        message:
          error instanceof Error ? error.message : 'Unknown workflow error',
      };
    }
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ) {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  }
}
