import { z } from 'zod';

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === undefined) {
      return false;
    }

    return value === 'true';
  });

export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .optional()
    .default('development'),
  PORT: z.coerce.number().int().positive().optional().default(3000),
  DATABASE_URL: optionalString,
  ADMIN_TOKEN: z
    .string()
    .trim()
    .min(12)
    .optional()
    .default('work-os-local-admin'),
  AI_MODE: z.enum(['stub', 'live']).optional().default('stub'),
  DEFAULT_AI_PROVIDER: z
    .enum(['stub', 'openai', 'anthropic'])
    .optional()
    .default('stub'),
  ACTION_EXECUTION_MODE: z.enum(['mock', 'live']).optional().default('mock'),
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().trim().optional().default('gpt-4.1-mini'),
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z
    .string()
    .trim()
    .optional()
    .default('claude-3-5-sonnet-latest'),
  SLACK_SKIP_SIGNATURE_VERIFICATION: booleanFromEnv,
  SLACK_BOT_TOKEN: optionalString,
  SLACK_SIGNING_SECRET: optionalString,
  JIRA_BASE_URL: optionalString,
  JIRA_PROJECT_KEY: optionalString,
  JIRA_USER_EMAIL: optionalString,
  JIRA_API_TOKEN: optionalString,
  GITHUB_TOKEN: optionalString,
  GITHUB_OWNER: optionalString,
  GITHUB_DEFAULT_REPOSITORY: optionalString,
  GITHUB_DEFAULT_BASE_BRANCH: optionalString,
  GITHUB_PR_CREATION_ENABLED: booleanFromEnv,
  GITHUB_DEFAULT_DRAFT_PR: booleanFromEnv,
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>) {
  return environmentSchema.parse(config);
}
