import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'provider_credentials' })
export class ProviderCredentialEntity {
  @PrimaryColumn()
  provider!: string;

  @Column({ type: 'text', default: 'api-key' })
  authType!: string;

  @Column({ type: 'simple-json', nullable: true })
  secretData!: Record<string, string> | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, string> | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
