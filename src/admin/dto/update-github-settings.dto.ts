import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateGitHubSettingsDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  defaultRepository?: string;

  @IsOptional()
  @IsString()
  defaultBaseBranch?: string;

  @IsOptional()
  @IsBoolean()
  prCreationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  defaultDraftPullRequest?: boolean;
}
