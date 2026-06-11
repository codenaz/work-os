import { IsOptional, IsString } from 'class-validator';

export class UpdateSlackSettingsDto {
  @IsOptional()
  @IsString()
  botToken?: string;

  @IsOptional()
  @IsString()
  signingSecret?: string;
}
