import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class GitHubClientService {
  constructor(private readonly settingsService: SettingsService) {}

  async getConnectionStatus() {
    const githubSettings = await this.settingsService.getGitHubSettings();
    return {
      configured: githubSettings.configured,
    };
  }
}
