"""
Jira Integration
================
Wraps the jira Python library for ticket queries and creation.
Configure via JIRA_SERVER, JIRA_EMAIL, JIRA_API_TOKEN env vars.
"""
import os
from jira import JIRA, JIRAError


def _get_client() -> JIRA:
    server = os.getenv("JIRA_SERVER")
    email = os.getenv("JIRA_EMAIL")
    token = os.getenv("JIRA_API_TOKEN")
    if not all([server, email, token]):
        raise EnvironmentError("JIRA_SERVER, JIRA_EMAIL, and JIRA_API_TOKEN must be set.")
    return JIRA(server=server, basic_auth=(email, token))


class JiraClient:
    def get_sprint_issues(self, project_key: str, status_filter: str = "all") -> list[dict]:
        """Get issues in the active sprint for a project."""
        jira = _get_client()

        jql_parts = [f"project = {project_key}", "sprint in openSprints()"]
        if status_filter == "blocked":
            jql_parts.append('status = "Blocked"')
        elif status_filter == "in-progress":
            jql_parts.append('status = "In Progress"')

        jql = " AND ".join(jql_parts) + " ORDER BY priority DESC"
        issues = jira.search_issues(jql, maxResults=50)

        return [
            {
                "key": i.key,
                "summary": i.fields.summary,
                "status": i.fields.status.name,
                "priority": i.fields.priority.name if i.fields.priority else "None",
                "assignee": i.fields.assignee.displayName if i.fields.assignee else "Unassigned",
                "issue_type": i.fields.issuetype.name,
                "url": f"{os.getenv('JIRA_SERVER')}/browse/{i.key}",
            }
            for i in issues
        ]

    def create_ticket(
        self,
        project_key: str,
        summary: str,
        description: str,
        issue_type: str = "Task",
        priority: str = "Medium",
        assignee_email: str | None = None,
    ) -> dict:
        """Create a new Jira issue and return its key and URL."""
        jira = _get_client()

        fields = {
            "project": {"key": project_key},
            "summary": summary,
            "description": description,
            "issuetype": {"name": issue_type},
            "priority": {"name": priority},
        }

        if assignee_email:
            try:
                users = jira.search_users(query=assignee_email)
                if users:
                    fields["assignee"] = {"accountId": users[0].accountId}
            except JIRAError:
                pass  # Skip assignee if lookup fails

        issue = jira.create_issue(fields=fields)
        return {
            "key": issue.key,
            "url": f"{os.getenv('JIRA_SERVER')}/browse/{issue.key}",
            "summary": summary,
            "status": "created",
        }

    def get_issue(self, issue_key: str) -> dict:
        jira = _get_client()
        i = jira.issue(issue_key)
        return {
            "key": i.key,
            "summary": i.fields.summary,
            "description": str(i.fields.description or ""),
            "status": i.fields.status.name,
            "assignee": i.fields.assignee.displayName if i.fields.assignee else "Unassigned",
            "priority": i.fields.priority.name if i.fields.priority else "None",
            "url": f"{os.getenv('JIRA_SERVER')}/browse/{i.key}",
        }
