from urllib.parse import urlparse
import requests

MAX_DIFF_LENGTH = 100_000

def parse_pr_url(pr_url: str):
    parsed = urlparse(pr_url)

    if parsed.scheme != "https" or parsed.netloc != "github.com":
        raise ValueError("Not a valid GitHub URL")

    parts = parsed.path.strip("/").split("/")

    if len(parts) != 4 or parts[2] != "pull":
        raise ValueError("Not a valid GitHub Pull Request URL")

    owner, repo, _, number = parts
    return owner, repo, int(number)

def fetch_diff(pr_url: str) -> str:
    diff_url = f"{pr_url}.diff"
    response = requests.get(diff_url)

    if response.status_code != 200:
        raise RuntimeError("Failed to fetch diff")

    diff = response.text

    if len(diff) > MAX_DIFF_LENGTH:
        print("⚠️ Diff too large, truncating")
        diff = diff[:MAX_DIFF_LENGTH] + "\n...[Diff Truncated]...\n"

    return diff

def fetch_comments(owner: str, repo: str, pr_number: int):
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments"

    headers = {
        "User-Agent": "AIP444-Lab-03",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise RuntimeError(f"GitHub API error: {response.status_code}")

    return [
        {
            "username": item["user"]["login"],
            "body": item["body"],
            "date": item["updated_at"]
        }
        for item in response.json()
    ]

SYSTEM_PROMPT = """
You are a Principal Engineer reviewing a GitHub Pull Request.

Your role is to help a junior developer understand both the technical
changes and the human discussion around the PR.

You value correctness, maintainability, and explicit assumptions.

Your output MUST be a Markdown report with exactly these sections:

## Summary
## The Discussion
## Assessment
## Socratic Questions
"""

def build_user_prompt(diff: str, comments: list) -> str:
    formatted_comments = "\n".join(
        '<comment username="{username}" date="{date}">\n{body}\n</comment>'.format(
            username=c["username"],
            date=c["date"],
            body=c["body"]
        )
        for c in comments
    )

    return (
        "### DIFF\n"
        "```diff\n"
        f"{diff}\n"
        "```\n\n"
        "<comments>\n"
        f"{formatted_comments}\n"
        "</comments>\n"
    )

if __name__ == "__main__":
    pr_url = "https://github.com/microsoft/vscode/pull/289801"

    owner, repo, number = parse_pr_url(pr_url)
    diff = fetch_diff(pr_url)
    comments = fetch_comments(owner, repo, number)

    print("====== SYSTEM PROMPT ======")
    print(SYSTEM_PROMPT)

    print("\n====== USER PROMPT ======")
    print(build_user_prompt(diff[:2000], comments[:2]))


