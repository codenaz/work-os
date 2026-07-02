import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment';
import { createTypeOrmOptions } from './typeorm.config';

const environment = validateEnvironment(
  process.env as Record<string, unknown>,
);

export default new DataSource(
  createTypeOrmOptions({
    nodeEnv: environment.NODE_ENV,
    databaseUrl: environment.DATABASE_URL,
    postgresHost: environment.POSTGRES_HOST,
    postgresPort: environment.POSTGRES_PORT,
    postgresUser: environment.POSTGRES_USER,
    postgresPassword: environment.POSTGRES_PASSWORD,
    postgresDatabase: environment.POSTGRES_DB,
  }),
);