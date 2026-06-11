import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'workflow_runs' })
export class WorkflowRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  sourceEventId!: string;

  @Column({ type: 'text' })
  source!: 'slack' | 'jira' | 'github';

  @Column({ type: 'text', nullable: true })
  provider!: string | null;

  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ type: 'text', nullable: true })
  action!: string | null;

  @Column({ type: 'text', default: 'queued' })
  status!: 'queued' | 'completed' | 'failed' | 'skipped';

  @Column({ type: 'text' })
  inputSummary!: string;

  @Column({ type: 'simple-json', nullable: true })
  output!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
