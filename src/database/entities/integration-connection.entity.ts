import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'integration_connections' })
export class IntegrationConnectionEntity {
  @PrimaryColumn()
  provider!: string;

  @Column({ type: 'text', default: 'needs-config' })
  status!: 'connected' | 'needs-config' | 'disabled';

  @Column({ type: 'simple-json', nullable: true })
  config!: Record<string, string> | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
