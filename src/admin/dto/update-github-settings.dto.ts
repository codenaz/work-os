import { IsOptional, IsString } from 'class-validator';

export class UpdateGitHubSettingsDto {
  @IsOptional()
  @IsString()
  token?: string;
}
