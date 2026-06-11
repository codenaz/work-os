import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'workspace_settings' })
export class WorkspaceSettingEntity {
  @PrimaryColumn()
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
