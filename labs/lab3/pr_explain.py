from urllib.parse import urlparse
import os
from dotenv import load_dotenv
from openai import OpenAI
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
Your role is to help a junior developer understand both the technical changes and the human discussion around the PR.
You value correctness, maintainability, code safety, and explicit assumptions.

You will come across two main sections of input:
1. A **DIFF** of the code changes (in a diff code block).
2. **COMMENTS** from the PR discussion (wrapped in <comments> XML tags).

Please follow this reasoning process before generating your report:
1.  **Analyze the DIFF** to understand the technical reality: what changed, why, and what are the implications.
2.  **Analyze the COMMENTS** to understand the human context: what concerns were raised, what decisions were made, and remaining disagreements.
3.  **Reflect** on the underlying assumptions, constraints, and edge cases.
4.  **Synthesize** your findings into the final report.

Your output MUST be a Markdown report with exactly these sections:

## Summary
What is the goal of this PR? Explain the context and the solution.

## The Discussion
Summarize the discussion. What was discussed? Who agreed? Who disagreed? Are there any blockers/resolutions?

## Assessment
Identify potential bugs, unhandled edge cases, or hidden assumptions in the code. Focus on correctness and maintainability.

## Socratic Questions
Generate 3 questions that would test the user's understanding of the changes (e.g., "Why did the author choose X instead of Y?").
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

    user_prompt = build_user_prompt(diff[:32000], comments)
    print("\n====== USER PROMPT ======")
    print(user_prompt)

    print("\n====== AGENT RESPONSE ======")
    load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))
    
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
    )

    completion = client.chat.completions.create(
        model="google/gemini-2.0-flash-001",
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )
    print(completion.choices[0].message.content)

