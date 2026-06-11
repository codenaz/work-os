import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly appConfigService: AppConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionToken = request.cookies?.work_os_admin_session as
      | string
      | undefined;

    if (sessionToken !== this.appConfigService.adminToken) {
      throw new UnauthorizedException('Admin session is not authenticated');
    }

    return true;
  }
}
