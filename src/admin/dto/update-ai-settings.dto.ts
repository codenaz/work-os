import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsIn(['stub', 'openai', 'anthropic'])
  selectedAiProvider?: 'stub' | 'openai' | 'anthropic';

  @IsOptional()
  @IsString()
  openAiApiKey?: string;

  @IsOptional()
  @IsString()
  openAiModel?: string;

  @IsOptional()
  @IsString()
  anthropicApiKey?: string;

  @IsOptional()
  @IsString()
  anthropicModel?: string;
}
