import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class JiraWebhookUserDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class JiraWebhookIssueFieldsDto {
  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  description?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  updated?: string;
}

export class JiraWebhookIssueDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => JiraWebhookIssueFieldsDto)
  fields?: JiraWebhookIssueFieldsDto;
}

export class JiraWebhookCommentDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;
}

export class JiraWebhookDto {
  @IsString()
  webhookEvent!: string;

  @IsOptional()
  @IsString()
  issue_event_type_name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => JiraWebhookUserDto)
  user?: JiraWebhookUserDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JiraWebhookIssueDto)
  issue?: JiraWebhookIssueDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => JiraWebhookCommentDto)
  comment?: JiraWebhookCommentDto;

  @IsOptional()
  timestamp?: number;
}