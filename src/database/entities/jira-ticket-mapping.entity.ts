import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'jira_ticket_mappings' })
export class JiraTicketMappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  workflowRunId!: string;

  @Column({ type: 'text' })
  sourceEventId!: string;

  @Column({ type: 'text' })
  issueKey!: string;

  @Column({ type: 'text' })
  issueUrl!: string;

  @Column({ type: 'text' })
  summary!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
