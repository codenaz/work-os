import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundEventEntity } from '../database/entities/inbound-event.entity';
import { CanonicalEventService } from './canonical-event.service';
import { InboundEventsService } from './inbound-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([InboundEventEntity])],
  providers: [CanonicalEventService, InboundEventsService],
  exports: [CanonicalEventService, InboundEventsService],
})
export class EventsModule {}
