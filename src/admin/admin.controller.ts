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
      return response.type('html').send(renderLoginPage(error));
    }

    const dashboard = await this.adminService.getDashboardData();
    return response
      .type('html')
      .send(renderDashboardPage(dashboard, message ?? error));
  }

  @Post('login')
  @Redirect('/admin')
  login(@Body() body: AdminLoginDto, @Res({ passthrough: true }) response: Response) {
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
    return response.type('html').send(renderEventsPartial(dashboard.recentEvents));
  }

  @Get('partials/runs')
  @UseGuards(AdminSessionGuard)
  async getRunsPartial(@Res() response: Response) {
    const dashboard = await this.adminService.getDashboardData();
    return response.type('html').send(renderRunsPartial(dashboard.recentRuns));
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
    return request.cookies?.work_os_admin_session === this.appConfigService.adminToken;
  }
}

function renderLoginPage(error?: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Work OS Admin</title>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main class="container narrow">
      <h1>Work OS admin</h1>
      ${error ? `<p class="notice error">${escapeHtml(error)}</p>` : ''}
      <form method="post" action="/admin/login" class="card stack">
        <label>
          <span>Admin token</span>
          <input name="token" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  </body>
</html>`;
}

function renderDashboardPage(
  dashboard: Awaited<ReturnType<AdminService['getDashboardData']>>,
  message?: string,
) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Work OS Admin</title>
    <script src="https://unpkg.com/htmx.org@2.0.4"></script>
    <style>${baseStyles}</style>
  </head>
  <body>
    <main class="container">
      <header class="header">
        <div>
          <h1>Work OS admin</h1>
          <p>Single-tenant control surface for Slack, Jira, GitHub, and AI routing.</p>
        </div>
        <form method="post" action="/admin/logout">
          <button type="submit" class="secondary">Sign out</button>
        </form>
      </header>
      ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ''}
      <section class="grid summary">
        <article class="card">
          <h2>Health</h2>
          <p>Status: <strong>${escapeHtml(dashboard.health.status)}</strong></p>
          <p>Persistence: ${escapeHtml(dashboard.health.modes.persistence)}</p>
          <p>AI: ${escapeHtml(dashboard.health.modes.ai)}</p>
          <p>Selected provider: ${escapeHtml(
            dashboard.health.modes.selectedProvider,
          )}</p>
          <p>Action mode: ${escapeHtml(dashboard.health.modes.actionExecution)}</p>
        </article>
        <article class="card">
          <h2>Integrations</h2>
          <p>Slack: ${renderStatus(dashboard.health.integrations.slack)}</p>
          <p>Jira: ${renderStatus(dashboard.health.integrations.jira)}</p>
          <p>GitHub: ${renderStatus(dashboard.health.integrations.github)}</p>
        </article>
      </section>
      <section class="grid">
        <form method="post" action="/admin/settings/modes" class="card stack">
          <h2>Runtime modes</h2>
          <label>
            <span>Selected AI provider</span>
            <select name="selectedAiProvider">
              ${renderSelectedOption('stub', dashboard.aiSettings.selectedProvider)}
              ${renderSelectedOption('openai', dashboard.aiSettings.selectedProvider)}
              ${renderSelectedOption(
                'anthropic',
                dashboard.aiSettings.selectedProvider,
              )}
            </select>
          </label>
          <label>
            <span>Action execution mode</span>
            <select name="actionExecutionMode">
              ${renderSelectedOption('mock', dashboard.actionExecutionMode)}
              ${renderSelectedOption('live', dashboard.actionExecutionMode)}
            </select>
          </label>
          <button type="submit">Save runtime modes</button>
        </form>
        <form method="post" action="/admin/settings/ai" class="card stack">
          <h2>AI providers</h2>
          <p>AI mode from environment: <strong>${escapeHtml(dashboard.aiSettings.mode)}</strong></p>
          <label>
            <span>OpenAI model</span>
            <input name="openAiModel" value="${escapeHtml(
              dashboard.aiSettings.openAiModel,
            )}" />
          </label>
          <label>
            <span>OpenAI API key</span>
            <input name="openAiApiKey" type="password" placeholder="${
              dashboard.aiSettings.openAiApiKeyConfigured ? 'configured' : 'not set'
            }" />
          </label>
          <label>
            <span>Anthropic model</span>
            <input name="anthropicModel" value="${escapeHtml(
              dashboard.aiSettings.anthropicModel,
            )}" />
          </label>
          <label>
            <span>Anthropic API key</span>
            <input name="anthropicApiKey" type="password" placeholder="${
              dashboard.aiSettings.anthropicApiKeyConfigured
                ? 'configured'
                : 'not set'
            }" />
          </label>
          <button type="submit">Save AI settings</button>
        </form>
        <form method="post" action="/admin/settings/slack" class="card stack">
          <h2>Slack</h2>
          <p>Configured: ${renderStatus(dashboard.slackSettings.configured)}</p>
          <label>
            <span>Bot token</span>
            <input name="botToken" type="password" placeholder="${
              dashboard.slackSettings.botTokenConfigured ? 'configured' : 'not set'
            }" />
          </label>
          <label>
            <span>Signing secret</span>
            <input name="signingSecret" type="password" placeholder="${
              dashboard.slackSettings.signingSecretConfigured
                ? 'configured'
                : 'not set'
            }" />
          </label>
          <button type="submit">Save Slack settings</button>
        </form>
        <form method="post" action="/admin/settings/jira" class="card stack">
          <h2>Jira</h2>
          <p>Configured: ${renderStatus(dashboard.jiraSettings.configured)}</p>
          <label>
            <span>Base URL</span>
            <input name="baseUrl" value="${escapeHtml(dashboard.jiraSettings.baseUrl)}" />
          </label>
          <label>
            <span>Project key</span>
            <input name="projectKey" value="${escapeHtml(
              dashboard.jiraSettings.projectKey,
            )}" />
          </label>
          <label>
            <span>User email</span>
            <input name="userEmail" value="${escapeHtml(
              dashboard.jiraSettings.userEmail,
            )}" />
          </label>
          <label>
            <span>API token</span>
            <input name="apiToken" type="password" placeholder="${
              dashboard.jiraSettings.apiTokenConfigured ? 'configured' : 'not set'
            }" />
          </label>
          <button type="submit">Save Jira settings</button>
        </form>
        <form method="post" action="/admin/settings/github" class="card stack">
          <h2>GitHub</h2>
          <p>Configured: ${renderStatus(dashboard.githubSettings.configured)}</p>
          <label>
            <span>Token</span>
            <input name="token" type="password" placeholder="${
              dashboard.githubSettings.tokenConfigured ? 'configured' : 'not set'
            }" />
          </label>
          <button type="submit">Save GitHub settings</button>
        </form>
      </section>
      <section class="grid">
        <article class="card">
          <div class="section-header">
            <h2>Recent inbound events</h2>
            <button
              class="secondary"
              hx-get="/admin/partials/events"
              hx-target="#events-partial"
              hx-swap="innerHTML"
            >
              Refresh
            </button>
          </div>
          <div
            id="events-partial"
            hx-get="/admin/partials/events"
            hx-trigger="load, every 10s"
            hx-swap="innerHTML"
          >
            ${renderEventsPartial(dashboard.recentEvents)}
          </div>
        </article>
        <article class="card">
          <div class="section-header">
            <h2>Recent workflow runs</h2>
            <button
              class="secondary"
              hx-get="/admin/partials/runs"
              hx-target="#runs-partial"
              hx-swap="innerHTML"
            >
              Refresh
            </button>
          </div>
          <div
            id="runs-partial"
            hx-get="/admin/partials/runs"
            hx-trigger="load, every 10s"
            hx-swap="innerHTML"
          >
            ${renderRunsPartial(dashboard.recentRuns)}
          </div>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

function renderEventsPartial(
  events: Awaited<ReturnType<AdminService['getDashboardData']>>['recentEvents'],
) {
  if (events.length === 0) {
    return '<p class="muted">No inbound events have been received yet.</p>';
  }

  return `<ul class="list">${events
    .map(
      (event) => `<li>
        <strong>${escapeHtml(event.source)}</strong> / ${escapeHtml(
          event.eventType,
        )} - ${escapeHtml(event.status)}
        <div class="muted">${escapeHtml(event.externalEventId)}</div>
      </li>`,
    )
    .join('')}</ul>`;
}

function renderRunsPartial(
  runs: Awaited<ReturnType<AdminService['getDashboardData']>>['recentRuns'],
) {
  if (runs.length === 0) {
    return '<p class="muted">No workflow runs have been executed yet.</p>';
  }

  return `<ul class="list">${runs
    .map(
      (run) => `<li>
        <strong>${escapeHtml(run.status)}</strong> - ${escapeHtml(
          run.action ?? 'pending',
        )}
        <div class="muted">${escapeHtml(run.inputSummary)}</div>
      </li>`,
    )
    .join('')}</ul>`;
}

function renderStatus(value: boolean) {
  return value ? '<strong class="good">configured</strong>' : '<strong class="bad">needs config</strong>';
}

function renderSelectedOption(value: string, selectedValue: string) {
  return `<option value="${escapeHtml(value)}"${
    value === selectedValue ? ' selected' : ''
  }>${escapeHtml(value)}</option>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const baseStyles = `
  :root {
    color-scheme: light dark;
    font-family: Inter, system-ui, sans-serif;
  }
  body {
    margin: 0;
    background: #0f172a;
    color: #e2e8f0;
  }
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  .container.narrow {
    max-width: 420px;
  }
  .header, .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    margin: 1rem 0;
  }
  .card {
    background: #111827;
    border: 1px solid #334155;
    border-radius: 0.75rem;
    padding: 1rem;
  }
  .stack {
    display: grid;
    gap: 0.75rem;
  }
  label {
    display: grid;
    gap: 0.35rem;
  }
  input, select, button {
    border-radius: 0.5rem;
    border: 1px solid #475569;
    background: #020617;
    color: inherit;
    padding: 0.7rem 0.8rem;
    font: inherit;
  }
  button {
    cursor: pointer;
    background: #2563eb;
    border-color: #2563eb;
  }
  button.secondary {
    background: transparent;
    border-color: #475569;
  }
  .notice {
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    background: #1d4ed8;
  }
  .notice.error {
    background: #991b1b;
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.75rem;
  }
  .muted {
    color: #94a3b8;
    font-size: 0.925rem;
  }
  .good {
    color: #4ade80;
  }
  .bad {
    color: #f87171;
  }
`;
