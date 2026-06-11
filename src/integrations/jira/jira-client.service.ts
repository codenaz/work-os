import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

interface JiraCreateIssueResponse {
  id?: string;
  key?: string;
  self?: string;
}

@Injectable()
export class JiraClientService {
  constructor(private readonly settingsService: SettingsService) {}

  async createIssue(params: { summary: string; description: string }) {
    const executionMode = await this.settingsService.getActionExecutionMode();

    if (executionMode === 'mock') {
      const issueKey = `MOCK-${Math.floor(Date.now() / 1000)}`;
      return {
        mode: 'mock' as const,
        issueKey,
        issueUrl: `https://jira.mock.local/browse/${issueKey}`,
      };
    }

    const jiraSettings = await this.settingsService.getJiraSettings();

    if (
      !jiraSettings.baseUrl ||
      !jiraSettings.projectKey ||
      !jiraSettings.userEmail ||
      !jiraSettings.apiToken
    ) {
      throw new ServiceUnavailableException(
        'Jira connection settings are not fully configured',
      );
    }

    const response = await fetch(`${jiraSettings.baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${jiraSettings.userEmail}:${jiraSettings.apiToken}`,
        ).toString('base64')}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: {
            key: jiraSettings.projectKey,
          },
          summary: params.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: params.description,
                  },
                ],
              },
            ],
          },
          issuetype: {
            name: 'Task',
          },
        },
      }),
    });
    const payload = (await response.json()) as JiraCreateIssueResponse;

    if (!response.ok || !payload.key) {
      throw new ServiceUnavailableException(
        `Jira create issue failed: ${response.statusText}`,
      );
    }

    return {
      mode: 'live' as const,
      issueKey: payload.key,
      issueUrl: `${jiraSettings.baseUrl}/browse/${payload.key}`,
    };
  }
}
