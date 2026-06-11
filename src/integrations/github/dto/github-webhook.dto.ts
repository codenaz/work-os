import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GitHubWebhookRepositoryOwnerDto {
  @IsOptional()
  @IsString()
  login?: string;
}

export class GitHubWebhookRepositoryDto {
  @IsString()
  full_name!: string;

  @IsString()
  name!: string;

  @ValidateNested()
  @Type(() => GitHubWebhookRepositoryOwnerDto)
  owner!: GitHubWebhookRepositoryOwnerDto;
}

export class GitHubWebhookSenderDto {
  @IsOptional()
  @IsString()
  login?: string;
}

export class GitHubWebhookIssueDto {
  @IsOptional()
  @IsInt()
  number?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

export class GitHubWebhookCommentDto {
  @IsOptional()
  @IsString()
  body?: string;
}

export class GitHubWebhookPullRequestDto {
  @IsOptional()
  @IsInt()
  number?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

export class GitHubWebhookDto {
  @IsIn(['issues', 'issue_comment', 'pull_request'])
  eventType!: 'issues' | 'issue_comment' | 'pull_request';

  @IsString()
  action!: string;

  @ValidateNested()
  @Type(() => GitHubWebhookRepositoryDto)
  repository!: GitHubWebhookRepositoryDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookIssueDto)
  issue?: GitHubWebhookIssueDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookCommentDto)
  comment?: GitHubWebhookCommentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookPullRequestDto)
  pull_request?: GitHubWebhookPullRequestDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GitHubWebhookSenderDto)
  sender?: GitHubWebhookSenderDto;

  @IsOptional()
  @IsObject()
  installation?: Record<string, unknown>;
}
