import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { AdminService } from './admin.service';
import { AdminSessionGuard } from './admin-session.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { UpdateGitHubSettingsDto } from './dto/update-github-settings.dto';
import { UpdateJiraSettingsDto } from './dto/update-jira-settings.dto';
import { UpdateModesDto } from './dto/update-modes.dto';
import { UpdateSlackSettingsDto } from './dto/update-slack-settings.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Get()
  async getDashboard(
    @Req() request: Request,
    @Res() response: Response,
    @Query('message') message?: string,
    @Query('error') error?: string,
  ) {
    if (!this.isAuthenticated(request)) {
      return response.render('login', {
        error,
      });
    }

    const dashboard = await this.adminService.getDashboardData();
    return response.render('dashboard', {
      ...dashboard,
      message: message ?? error,
      messageIsError: Boolean(error && !message),
      selectedProviderOptions: ['stub', 'openai', 'anthropic'].map((value) => ({
        value,
        selected: value === dashboard.aiSettings.selectedProvider,
      })),
      actionExecutionOptions: ['mock', 'live'].map((value) => ({
        value,
        selected: value === dashboard.actionExecutionMode,
      })),
    });
  }

  @Post('login')
  @Redirect('/admin')
  login(
    @Body() body: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (body.token !== this.appConfigService.adminToken) {
      return {
        url: '/admin?error=Invalid%20admin%20token',
      };
    }

    response.cookie('work_os_admin_session', body.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.appConfigService.nodeEnv === 'production',
    });

    return {
      url: '/admin?message=Signed%20in',
    };
  }

  @Post('logout')
  @Redirect('/admin')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('work_os_admin_session');

    return {
      url: '/admin?message=Signed%20out',
    };
  }

  @Get('partials/events')
  @UseGuards(AdminSessionGuard)
  async getEventsPartial(@Res() response: Response) {
    const dashboard = await this.adminService.getDashboardData();
    return response.render('partials/events', {
      layout: false,
      recentEvents: dashboard.recentEvents,
    });
  }

  @Get('partials/runs')
  @UseGuards(AdminSessionGuard)
  async getRunsPartial(@Res() response: Response) {
    const dashboard = await this.adminService.getDashboardData();
    return response.render('partials/runs', {
      layout: false,
      recentRuns: dashboard.recentRuns,
    });
  }

  @Post('settings/modes')
  @UseGuards(AdminSessionGuard)
  @Redirect('/admin')
  async updateModes(@Body() body: UpdateModesDto) {
    await this.adminService.updateModes(body);
    return {
      url: '/admin?message=Runtime%20modes%20updated',
    };
  }

  @Post('settings/ai')
  @UseGuards(AdminSessionGuard)
  @Redirect('/admin')
  async updateAiSettings(@Body() body: UpdateAiSettingsDto) {
    await this.adminService.updateAiSettings(body);
    return {
      url: '/admin?message=AI%20settings%20updated',
    };
  }

  @Post('settings/slack')
  @UseGuards(AdminSessionGuard)
  @Redirect('/admin')
  async updateSlackSettings(@Body() body: UpdateSlackSettingsDto) {
    await this.adminService.updateSlackSettings(body);
    return {
      url: '/admin?message=Slack%20settings%20updated',
    };
  }

  @Post('settings/jira')
  @UseGuards(AdminSessionGuard)
  @Redirect('/admin')
  async updateJiraSettings(@Body() body: UpdateJiraSettingsDto) {
    await this.adminService.updateJiraSettings(body);
    return {
      url: '/admin?message=Jira%20settings%20updated',
    };
  }

  @Post('settings/github')
  @UseGuards(AdminSessionGuard)
  @Redirect('/admin')
  async updateGitHubSettings(@Body() body: UpdateGitHubSettingsDto) {
    await this.adminService.updateGitHubSettings(body);
    return {
      url: '/admin?message=GitHub%20settings%20updated',
    };
  }

  private isAuthenticated(request: Request) {
    return (
      request.cookies?.work_os_admin_session ===
      this.appConfigService.adminToken
    );
  }
}
