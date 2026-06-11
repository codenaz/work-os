import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { IncomingHttpHeaders } from 'http';
import { AppConfigService } from '../../config/app-config.service';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class SlackSignatureService {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  async verifyRequest(headers: IncomingHttpHeaders, rawBody?: Buffer) {
    if (this.appConfigService.slackSkipSignatureVerification) {
      return;
    }

    if (!rawBody) {
      throw new UnauthorizedException('Slack webhook raw body is required');
    }

    const signingSecret = await this.getSigningSecret();

    if (!signingSecret) {
      throw new ServiceUnavailableException(
        'Slack signing secret is not configured',
      );
    }

    const timestamp = this.getHeader(headers, 'x-slack-request-timestamp');
    const signature = this.getHeader(headers, 'x-slack-signature');

    if (!timestamp || !signature) {
      throw new UnauthorizedException('Missing Slack signature headers');
    }

    const requestAgeInSeconds = Math.abs(
      Math.floor(Date.now() / 1000) - Number(timestamp),
    );

    if (requestAgeInSeconds > 60 * 5) {
      throw new UnauthorizedException('Slack request timestamp is too old');
    }

    const signatureBase = `v0:${timestamp}:${rawBody.toString('utf8')}`;
    const expectedSignature = `v0=${createHmac('sha256', signingSecret)
      .update(signatureBase)
      .digest('hex')}`;

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Slack signature verification failed');
    }
  }

  private async getSigningSecret() {
    const slackSettings = await this.settingsService.getSlackSettings();
    return slackSettings.signingSecret;
  }

  private getHeader(headers: IncomingHttpHeaders, key: string) {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  }
}
