/**
 * MCP-style tool definitions for YouTrack, executed via REST inside the extension.
 * Mirrors common YouTrack MCP tool shapes; does not run an external MCP server.
 */

import { YouTrackAPIClient } from './youTrackAPIClient';

export type OpenAIToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export function getYouTrackOpenAITools(): OpenAIToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'youtrack_get_issue',
        description:
          'Load a YouTrack issue by readable id (e.g. DEV-123). Returns JSON fields from the REST API.',
        parameters: {
          type: 'object',
          properties: {
            issue_id: { type: 'string', description: 'Readable issue id, e.g. DEV-123' }
          },
          required: ['issue_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'youtrack_search_issues',
        description: 'Search issues using YouTrack query language (same as the search box).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'YouTrack query string' },
            limit: { type: 'integer', description: 'Max issues to return (default 10, max 20)' }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'youtrack_apply_command',
        description:
          'Run a YouTrack command on an issue (e.g. "State: In Progress", "Priority: Major", "Assignee: me").',
        parameters: {
          type: 'object',
          properties: {
            issue_id: { type: 'string' },
            command: { type: 'string', description: 'Full command string' },
            comment: { type: 'string', description: 'Optional comment' }
          },
          required: ['issue_id', 'command']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'youtrack_create_subtask',
        description: 'Create a subtask under a parent issue.',
        parameters: {
          type: 'object',
          properties: {
            parent_issue_id: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['parent_issue_id', 'summary']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'youtrack_update_issue',
        description: 'Patch issue fields: summary, description, state name, priority name, or assignee login.',
        parameters: {
          type: 'object',
          properties: {
            issue_id: { type: 'string' },
            summary: { type: 'string' },
            description: { type: 'string' },
            state: { type: 'string' },
            priority: { type: 'string' },
            assignee: { type: 'string', description: 'User login' }
          },
          required: ['issue_id']
        }
      }
    }
  ];
}

export async function executeYouTrackTool(
  client: YouTrackAPIClient,
  name: string,
  rawArgs: string
): Promise<{ ok: boolean; result: unknown; summary: string }> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || '{}') as Record<string, unknown>;
  } catch {
    return { ok: false, result: null, summary: `${name}: invalid JSON arguments` };
  }

  switch (name) {
    case 'youtrack_get_issue': {
      const issue_id = String(args.issue_id || '');
      const data = await client.getIssueDetails(issue_id);
      return {
        ok: !!data,
        result: data,
        summary: data ? `youtrack_get_issue(${issue_id}): ok` : `youtrack_get_issue(${issue_id}): not found`
      };
    }
    case 'youtrack_search_issues': {
      const query = String(args.query || '');
      const limit = Math.min(20, Math.max(1, Number(args.limit) || 10));
      const res = await client.searchIssues(query, limit);
      return {
        ok: res.success,
        result: res.data ?? { error: res.error },
        summary: res.success
          ? `youtrack_search_issues: ${Array.isArray(res.data) ? res.data.length : 0} issues`
          : `youtrack_search_issues: failed`
      };
    }
    case 'youtrack_apply_command': {
      const issue_id = String(args.issue_id || '');
      const command = String(args.command || '');
      const comment = args.comment != null ? String(args.comment) : undefined;
      const res = await client.executeCommand(issue_id, command, comment);
      return {
        ok: res.success,
        result: res.data ?? { error: res.error },
        summary: res.success ? `youtrack_apply_command(${issue_id}): ok` : `youtrack_apply_command: failed`
      };
    }
    case 'youtrack_create_subtask': {
      const parent_issue_id = String(args.parent_issue_id || '');
      const summary = String(args.summary || '');
      const description = args.description != null ? String(args.description) : undefined;
      const res = await client.createSubtask(parent_issue_id, summary, description);
      return {
        ok: res.success,
        result: res.data ?? { error: res.error },
        summary: res.success ? `youtrack_create_subtask: ok` : `youtrack_create_subtask: failed`
      };
    }
    case 'youtrack_update_issue': {
      const issue_id = String(args.issue_id || '');
      const updates: {
        summary?: string;
        description?: string;
        state?: string;
        priority?: string;
        assignee?: string;
      } = {};
      if (args.summary !== undefined) updates.summary = String(args.summary);
      if (args.description !== undefined) updates.description = String(args.description);
      if (args.state !== undefined) updates.state = String(args.state);
      if (args.priority !== undefined) updates.priority = String(args.priority);
      if (args.assignee !== undefined) updates.assignee = String(args.assignee);
      const res = await client.updateIssue(issue_id, updates);
      return {
        ok: res.success,
        result: res.data ?? { error: res.error },
        summary: res.success ? `youtrack_update_issue(${issue_id}): ok` : `youtrack_update_issue: failed`
      };
    }
    default:
      return { ok: false, result: null, summary: `Unknown tool: ${name}` };
  }
}
