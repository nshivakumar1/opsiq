"""
GitHub Integration
==================
Wraps the PyGitHub library to expose clean methods for OpsIQ's tool calls.
Configure via GITHUB_TOKEN and GITHUB_REPO env vars.
"""
import os
from datetime import datetime, timedelta, timezone

from github import Github, GithubException


class GitHubClient:
    def __init__(self):
        token = os.getenv("GITHUB_TOKEN")
        if not token:
            raise EnvironmentError("GITHUB_TOKEN is not set.")
        self.gh = Github(token)
        repo_name = os.getenv("GITHUB_REPO")
        if not repo_name:
            raise EnvironmentError("GITHUB_REPO is not set (e.g. 'acme/api-service').")
        self.repo = self.gh.get_repo(repo_name)

    def get_recent_commits(self, branch: str = "main", hours: int = 24) -> list[dict]:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        commits = self.repo.get_commits(sha=branch, since=since)
        return [
            {
                "sha": c.sha[:7],
                "author": c.commit.author.name,
                "email": c.commit.author.email,
                "message": c.commit.message.splitlines()[0],
                "timestamp": c.commit.author.date.isoformat(),
                "url": c.html_url,
            }
            for c in commits[:50]
        ]

    def get_open_prs(self, state: str = "open", limit: int = 10) -> list[dict]:
        pulls = self.repo.get_pulls(state=state, sort="updated", direction="desc")
        results = []
        for pr in pulls[:limit]:
            results.append({
                "number": pr.number,
                "title": pr.title,
                "author": pr.user.login,
                "state": pr.state,
                "draft": pr.draft,
                "created_at": pr.created_at.isoformat(),
                "updated_at": pr.updated_at.isoformat(),
                "url": pr.html_url,
                "reviewers": [r.login for r in pr.requested_reviewers],
                "labels": [la.name for la in pr.labels],
            })
        return results

    def get_deployments(self, environment: str = "production", limit: int = 10) -> list[dict]:
        deployments = self.repo.get_deployments(environment=environment)
        results = []
        for dep in deployments[:limit]:
            statuses = list(dep.get_statuses())
            latest_status = statuses[0].state if statuses else "unknown"
            results.append({
                "id": dep.id,
                "environment": dep.environment,
                "ref": dep.ref,
                "sha": dep.sha[:7],
                "creator": dep.creator.login if dep.creator else "unknown",
                "created_at": dep.created_at.isoformat(),
                "status": latest_status,
                "url": dep.url,
            })
        return results

    def get_issues(self, labels: list[str] | None = None, state: str = "open") -> list[dict]:
        kwargs = {"state": state}
        if labels:
            kwargs["labels"] = labels
        issues = self.repo.get_issues(**kwargs)
        return [
            {
                "number": i.number,
                "title": i.title,
                "state": i.state,
                "author": i.user.login,
                "assignees": [a.login for a in i.assignees],
                "labels": [la.name for la in i.labels],
                "created_at": i.created_at.isoformat(),
                "url": i.html_url,
            }
            for i in issues[:20]
        ]
