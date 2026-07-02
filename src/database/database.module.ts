import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/app-config.service';
import { createTypeOrmOptions, databaseEntities } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) =>
        createTypeOrmOptions({
          nodeEnv: appConfigService.nodeEnv,
          databaseUrl: appConfigService.databaseUrl,
          postgresHost: appConfigService.postgresHost,
          postgresPort: appConfigService.postgresPort,
          postgresUser: appConfigService.postgresUser,
          postgresPassword: appConfigService.postgresPassword,
          postgresDatabase: appConfigService.postgresDatabase,
        }),
    }),
    TypeOrmModule.forFeature([...databaseEntities]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
