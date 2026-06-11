import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowRunEntity } from '../database/entities/workflow-run.entity';
import { EventsModule } from '../events/events.module';
import { HealthModule } from '../health/health.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminController } from './admin.controller';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [
    SettingsModule,
    EventsModule,
    HealthModule,
    TypeOrmModule.forFeature([WorkflowRunEntity]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminSessionGuard],
})
export class AdminModule {}
