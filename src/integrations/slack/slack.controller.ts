import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { WorkflowOrchestratorService } from '../../ai/workflow-orchestrator.service';
import { CanonicalEventService } from '../../events/canonical-event.service';
import { InboundEventsService } from '../../events/inbound-events.service';
import { SlackEventEnvelopeDto } from './dto/slack-event-envelope.dto';
import { SlackSignatureService } from './slack-signature.service';

@Controller('webhooks/slack')
export class SlackController {
  constructor(
    private readonly slackSignatureService: SlackSignatureService,
    private readonly canonicalEventService: CanonicalEventService,
    private readonly inboundEventsService: InboundEventsService,
    private readonly workflowOrchestratorService: WorkflowOrchestratorService,
  ) {}

  @Post('events')
  async handleEvents(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: SlackEventEnvelopeDto,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    await this.slackSignatureService.verifyRequest(headers, request.rawBody);

    if (body.type === 'url_verification') {
      return {
        challenge: body.challenge,
      };
    }

    const canonicalEvent = this.canonicalEventService.fromSlackEvent(body);
    const eventId = body.event_id ?? 'unknown';
    const recordedEvent = await this.inboundEventsService.recordReceivedEvent({
      source: 'slack',
      eventType: body.event?.type ?? 'unknown',
      externalEventId: eventId,
      idempotencyKey: `slack:${eventId}`,
      correlationId: eventId,
      payload: body as unknown as Record<string, unknown>,
      canonicalEvent,
    });

    if (!recordedEvent.created) {
      return {
        ok: true,
        duplicate: true,
        status: recordedEvent.event.status,
        eventId,
      };
    }

    if (!canonicalEvent) {
      await this.inboundEventsService.markIgnored(
        recordedEvent.event.id,
        'Slack event type is not handled by the current MVP policy',
      );

      return {
        ok: true,
        status: 'ignored',
        eventId,
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
        status: 'processed',
        eventId,
        workflowRunId: workflowRun.id,
      };
    } catch (error) {
      return {
        ok: true,
        status: 'failed',
        eventId,
        message: error instanceof Error ? error.message : 'Unknown workflow error',
      };
    }
  }
}
