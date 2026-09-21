import { Module } from '@nestjs/common';
import { AuthController, AuthService, RoleGuard, SessionGuard } from './auth';
import { CollectorController, CollectorService } from './collector';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { SourcesController, SourcesService } from './sources';
import { AdminPortalController, PortalController, PortalService } from './portal';
import { ExamController, ExamService } from './exam';

@Module({ controllers: [HealthController, AuthController, SourcesController, CollectorController, PortalController, AdminPortalController, ExamController], providers: [PrismaService, AuthService, SessionGuard, RoleGuard, SourcesService, CollectorService, PortalService, ExamService] })
export class AppModule {}
