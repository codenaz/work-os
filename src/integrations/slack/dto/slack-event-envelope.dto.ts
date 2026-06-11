import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SlackInnerEventDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  channel_type?: string;

  @IsOptional()
  @IsString()
  ts?: string;

  @IsOptional()
  @IsString()
  thread_ts?: string;

  @IsOptional()
  @IsString()
  subtype?: string;

  @IsOptional()
  @IsString()
  bot_id?: string;
}

export class SlackEventEnvelopeDto {
  @IsIn(['url_verification', 'event_callback'])
  type!: 'url_verification' | 'event_callback';

  @IsOptional()
  @IsString()
  challenge?: string;

  @IsOptional()
  @IsString()
  event_id?: string;

  @IsOptional()
  @IsInt()
  event_time?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SlackInnerEventDto)
  event?: SlackInnerEventDto;
}
