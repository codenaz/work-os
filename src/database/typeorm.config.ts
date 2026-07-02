import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { join } from 'path';
import { AuditLogEntity } from './entities/audit-log.entity';
import { InboundEventEntity } from './entities/inbound-event.entity';
import { IntegrationConnectionEntity } from './entities/integration-connection.entity';
import { JiraTicketMappingEntity } from './entities/jira-ticket-mapping.entity';
import { ProviderCredentialEntity } from './entities/provider-credential.entity';
import { WorkflowRunEntity } from './entities/workflow-run.entity';
import { WorkspaceSettingEntity } from './entities/workspace-setting.entity';

export const databaseEntities = [
  WorkspaceSettingEntity,
  ProviderCredentialEntity,
  IntegrationConnectionEntity,
  InboundEventEntity,
  WorkflowRunEntity,
  AuditLogEntity,
  JiraTicketMappingEntity,
] as const;

type TypeOrmConfigInput = {
  nodeEnv: 'development' | 'test' | 'production';
  databaseUrl?: string;
  postgresHost: string;
  postgresPort: number;
  postgresUser: string;
  postgresPassword: string;
  postgresDatabase: string;
};

export function createTypeOrmOptions(
  input: TypeOrmConfigInput,
): TypeOrmModuleOptions & DataSourceOptions {
  if (input.nodeEnv === 'test') {
    return {
      type: 'sqljs',
      entities: [...databaseEntities],
      synchronize: true,
      autoSave: false,
    };
  }

  if (!input.databaseUrl) {
    return {
      type: 'postgres',
      host: input.postgresHost,
      port: input.postgresPort,
      username: input.postgresUser,
      password: input.postgresPassword,
      database: input.postgresDatabase,
      entities: [...databaseEntities],
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
      synchronize: false,
      migrationsRun: false,
    };
  }

  return {
    type: 'postgres',
    url: input.databaseUrl,
    entities: [...databaseEntities],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
  };
}