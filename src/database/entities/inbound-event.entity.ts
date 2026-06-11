import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'inbound_events' })
@Index(['idempotencyKey'], { unique: true })
export class InboundEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  source!: 'slack' | 'jira' | 'github';

  @Column({ type: 'text' })
  eventType!: string;

  @Column({ type: 'text' })
  externalEventId!: string;

  @Column({ type: 'text' })
  idempotencyKey!: string;

  @Column({ type: 'text' })
  correlationId!: string;

  @Column({ type: 'text', default: 'received' })
  status!: 'received' | 'ignored' | 'processed' | 'failed';

  @Column({ type: 'simple-json' })
  payload!: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  canonicalEvent!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
