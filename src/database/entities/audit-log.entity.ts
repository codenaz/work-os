import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  actor!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text' })
  status!: 'succeeded' | 'failed';

  @Column({ type: 'text' })
  entityType!: string;

  @Column({ type: 'text', nullable: true })
  entityId!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  details!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
