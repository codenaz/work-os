import { IsOptional, IsString } from 'class-validator';

export class UpdateJiraSettingsDto {
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  projectKey?: string;

  @IsOptional()
  @IsString()
  userEmail?: string;

  @IsOptional()
  @IsString()
  apiToken?: string;
}
