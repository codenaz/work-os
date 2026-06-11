import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

interface SlackPostMessageResponse {
  ok?: boolean;
  ts?: string;
  error?: string;
}

@Injectable()
export class SlackClientService {
  constructor(private readonly settingsService: SettingsService) {}

  async sendMessage(params: {
    channelId: string;
    text: string;
    threadTs?: string;
  }) {
    const executionMode = await this.settingsService.getActionExecutionMode();

    if (executionMode === 'mock') {
      return {
        mode: 'mock' as const,
        ts: `${Date.now()}.000000`,
      };
    }

    const slackSettings = await this.settingsService.getSlackSettings();

    if (!slackSettings.botToken) {
      throw new ServiceUnavailableException('Slack bot token is not configured');
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slackSettings.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: params.channelId,
        text: params.text,
        thread_ts: params.threadTs,
      }),
    });
    const payload = (await response.json()) as SlackPostMessageResponse;

    if (!response.ok || !payload.ok || !payload.ts) {
      throw new ServiceUnavailableException(
        `Slack postMessage failed: ${payload.error ?? response.statusText}`,
      );
    }

    return {
      mode: 'live' as const,
      ts: payload.ts,
    };
  }
}
