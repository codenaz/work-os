import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GitHubWebhookUserDto {
  @IsOptional()
  @IsString()
  login?: string;
}

export class GitHubWebhookPullRequestDto {
  @IsOptional()
  number?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  html_url?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookUserDto)
  user?: GitHubWebhookUserDto;
}

export class GitHubWebhookIssueDto {
  @IsOptional()
  number?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  html_url?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookUserDto)
  user?: GitHubWebhookUserDto;
}

export class GitHubWebhookRepositoryDto {
  @IsOptional()
  @IsString()
  full_name?: string;
}

export class GitHubWebhookDto {
  @IsString()
  @IsIn(['opened', 'edited', 'reopened'])
  action!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookPullRequestDto)
  pull_request?: GitHubWebhookPullRequestDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookIssueDto)
  issue?: GitHubWebhookIssueDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookRepositoryDto)
  repository?: GitHubWebhookRepositoryDto;

  @IsOptional()
  @IsObject()
  sender?: Record<string, unknown>;
}
