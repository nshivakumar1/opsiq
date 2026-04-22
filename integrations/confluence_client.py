"""
Confluence Integration
======================
Wraps the atlassian-python-api library for searching pages/runbooks.
Configure via CONFLUENCE_URL, CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN.
"""
import os
from atlassian import Confluence


class ConfluenceClient:
    def __init__(self):
        url = os.getenv("CONFLUENCE_URL")
        email = os.getenv("CONFLUENCE_EMAIL")
        token = os.getenv("CONFLUENCE_API_TOKEN")
        if not all([url, email, token]):
            raise EnvironmentError(
                "CONFLUENCE_URL, CONFLUENCE_EMAIL, and CONFLUENCE_API_TOKEN must be set."
            )
        self.client = Confluence(url=url, username=email, password=token, cloud=True)

    def search(self, query: str, space_key: str | None = None, limit: int = 5) -> list[dict]:
        """Full-text search across Confluence pages."""
        cql = f'text ~ "{query}" AND type = "page"'
        if space_key:
            cql += f' AND space = "{space_key}"'

        results = self.client.cql(cql, limit=limit).get("results", [])
        pages = []
        for r in results:
            content = r.get("content", {})
            page_id = content.get("id", "")
            page = self.client.get_page_by_id(page_id, expand="body.storage") if page_id else {}
            body_text = ""
            if page:
                raw_html = page.get("body", {}).get("storage", {}).get("value", "")
                # Strip basic HTML tags for readable preview
                import re
                body_text = re.sub(r"<[^>]+>", " ", raw_html)[:800].strip()

            pages.append({
                "title": content.get("title", ""),
                "space": r.get("resultGlobalContainer", {}).get("title", ""),
                "url": os.getenv("CONFLUENCE_URL", "") + content.get("_links", {}).get("webui", ""),
                "excerpt": body_text,
            })
        return pages
