import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'off', 'no'].includes(normalized)) {
      return false;
    }
  }

  return value;
}

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
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  prCreationEnabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  defaultDraftPr?: boolean;
}
