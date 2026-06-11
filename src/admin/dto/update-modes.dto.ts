import { IsIn } from 'class-validator';

export class UpdateModesDto {
  @IsIn(['stub', 'openai', 'anthropic'])
  selectedAiProvider!: 'stub' | 'openai' | 'anthropic';

  @IsIn(['mock', 'live'])
  actionExecutionMode!: 'mock' | 'live';
}
