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
    const githubEventType = this.getHeader(headers, 'x-github-event');
    const sourceEventId =
      deliveryId ??
      `${githubEventType ?? 'unknown'}:${body.action}:${Date.now().toString()}`;
    const canonicalEvent = this.canonicalEventService.fromGitHubEvent(
      body,
      githubEventType,
      sourceEventId,
    );
    const recordedEvent = await this.inboundEventsService.recordReceivedEvent({
      source: 'github',
      eventType: githubEventType ?? 'unknown',
      externalEventId: sourceEventId,
      idempotencyKey: `github:${sourceEventId}`,
      correlationId: sourceEventId,
      payload: body as unknown as Record<string, unknown>,
      canonicalEvent,
    });

    if (!recordedEvent.created) {
      return {
        ok: true,
        duplicate: true,
        status: recordedEvent.event.status,
        eventId: sourceEventId,
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
        eventId: sourceEventId,
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
        eventId: sourceEventId,
        workflowRunId: workflowRun.id,
      };
    } catch (error) {
      return {
        ok: true,
        status: 'failed',
        eventId: sourceEventId,
        message: error instanceof Error ? error.message : 'Unknown workflow error',
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
