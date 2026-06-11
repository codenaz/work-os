import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AiProviderFactory {
  constructor(private readonly settingsService: SettingsService) {}

  async createConfiguredModel() {
    const aiSettings = await this.settingsService.getAiSettings();

    if (aiSettings.mode !== 'live' || aiSettings.selectedProvider === 'stub') {
      return null;
    }

    if (aiSettings.selectedProvider === 'openai') {
      const credential =
        await this.settingsService.getProviderCredential('openai');
      const apiKey = credential?.secretData?.apiKey;

      if (!apiKey) {
        throw new InternalServerErrorException(
          'OpenAI is selected but no API key is configured',
        );
      }

      return {
        provider: 'openai' as const,
        model: aiSettings.openAiModel,
        client: new ChatOpenAI({
          apiKey,
          model: aiSettings.openAiModel,
        }),
      };
    }

    if (aiSettings.selectedProvider === 'anthropic') {
      const credential =
        await this.settingsService.getProviderCredential('anthropic');
      const apiKey = credential?.secretData?.apiKey;

      if (!apiKey) {
        throw new InternalServerErrorException(
          'Anthropic is selected but no API key is configured',
        );
      }

      return {
        provider: 'anthropic' as const,
        model: aiSettings.anthropicModel,
        client: new ChatAnthropic({
          apiKey,
          model: aiSettings.anthropicModel,
        }),
      };
    }

    return null;
  }
}
