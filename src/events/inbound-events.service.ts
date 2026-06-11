import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InboundEventEntity } from '../database/entities/inbound-event.entity';
import { CanonicalEvent } from './canonical-event';

@Injectable()
export class InboundEventsService {
  constructor(
    @InjectRepository(InboundEventEntity)
    private readonly inboundEventsRepository: Repository<InboundEventEntity>,
  ) {}

  async recordReceivedEvent(params: {
    source: 'slack' | 'jira' | 'github';
    eventType: string;
    externalEventId: string;
    idempotencyKey: string;
    correlationId: string;
    payload: Record<string, unknown>;
    canonicalEvent?: CanonicalEvent | null;
  }) {
    const existing = await this.inboundEventsRepository.findOneBy({
      idempotencyKey: params.idempotencyKey,
    });

    if (existing) {
      return {
        created: false,
        event: existing,
      };
    }

    const event = await this.inboundEventsRepository.save({
      source: params.source,
      eventType: params.eventType,
      externalEventId: params.externalEventId,
      idempotencyKey: params.idempotencyKey,
      correlationId: params.correlationId,
      payload: params.payload,
      canonicalEvent: params.canonicalEvent
        ? (params.canonicalEvent as unknown as Record<string, unknown>)
        : null,
      status: params.canonicalEvent ? 'received' : 'ignored',
    });

    return {
      created: true,
      event,
    };
  }

  async markProcessed(
    id: string,
    canonicalEvent: CanonicalEvent,
    output: Record<string, unknown>,
  ) {
    await this.inboundEventsRepository.update(
      { id },
      {
        status: 'processed',
        canonicalEvent: {
          ...(canonicalEvent as unknown as Record<string, unknown>),
          output,
        },
        errorMessage: null,
      },
    );
  }

  async markIgnored(id: string, reason: string) {
    await this.inboundEventsRepository.update(
      { id },
      {
        status: 'ignored',
        errorMessage: reason,
      },
    );
  }

  async markFailed(id: string, message: string) {
    await this.inboundEventsRepository.update(
      { id },
      {
        status: 'failed',
        errorMessage: message,
      },
    );
  }

  async getRecentEvents(limit = 10) {
    return this.inboundEventsRepository.find({
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }
}
