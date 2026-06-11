import { createHmac } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { SettingsService } from '../../settings/settings.service';
import { SlackSignatureService } from './slack-signature.service';

describe('SlackSignatureService', () => {
  it('accepts a valid Slack signature', async () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'url_verification' }));
    const timestamp = `${Math.floor(Date.now() / 1000)}`;
    const signingSecret = 'super-secret-signing-key';
    const signature = `v0=${createHmac('sha256', signingSecret)
      .update(`v0:${timestamp}:${rawBody.toString('utf8')}`)
      .digest('hex')}`;

    const service = new SlackSignatureService(
      {
        slackSkipSignatureVerification: false,
      } as AppConfigService,
      {
        getSlackSettings: jest.fn().mockResolvedValue({
          signingSecret,
        }),
      } as unknown as SettingsService,
    );

    await expect(
      service.verifyRequest(
        {
          'x-slack-request-timestamp': timestamp,
          'x-slack-signature': signature,
        },
        rawBody,
      ),
    ).resolves.toBeUndefined();
  });
});
