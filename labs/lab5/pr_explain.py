from urllib.parse import urlparse
import os
from dotenv import load_dotenv
from openai import OpenAI
import requests
from tools import get_github_file
import json

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

You have access to a tool called `get_github_file`.

Use this tool when:
- The diff does not provide enough context to understand the *why* or *how* of a change.
- You need to see the definition of a symbol, class, or constant used in the modified code.
- You need to review existing logic in a file that was not changed but is relevant.

Do NOT use the tool when:
- The diff is self-contained and the change is obvious.
- The change is a simple typo fix or documentation update.
- The comments already explain the context sufficiently.

However, if the user explicitly asks you to fetch a file, you MUST use the tool.

Only fetch files that are directly relevant.

When you use the tool, the content might be truncated. If you see "[File truncated...]", understand that you only have the beginning of the file. If the relevant code is likely at the end, you might not see it (currently the tool only fetches the top) - in that case, do your best with what you have or explain the limitation.
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

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_github_file",
            "description": "Fetch the full content of a file from a GitHub repository. Use this when the diff is insufficient to understand the context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "owner": {
                        "type": "string",
                        "description": "The owner of the repository (e.g., 'microsoft')"
                    },
                    "repo": {
                        "type": "string",
                        "description": "The name of the repository (e.g., 'vscode')"
                    },
                    "filepath": {
                        "type": "string",
                        "description": "The path to the file (e.g., 'src/vs/editor/common/model.ts')"
                    },
                    "ref": {
                        "type": "string",
                        "description": "The branch, tag, or commit SHA. Defaults to 'main'. Use the value from the PR if possible."
                    }
                },
                "required": ["owner", "repo", "filepath"],
                "additionalProperties": False
            }
        }
    }
]

if __name__ == "__main__":
    load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))
    
    # Check for API key
    if not os.getenv("OPENROUTER_API_KEY"):
        print("❌ Error: OPENROUTER_API_KEY not found in environment variables.")
        exit(1)

    pr_url = "https://github.com/microsoft/vscode/pull/289801"

    print(f"Analyzing PR: {pr_url}")
    try:
        owner, repo, number = parse_pr_url(pr_url)
        diff = fetch_diff(pr_url)
        comments = fetch_comments(owner, repo, number)
    except Exception as e:
        print(f"❌ Error fetching PR data: {e}")
        exit(1)

    print("====== SYSTEM PROMPT ======")
    print(SYSTEM_PROMPT)

    user_prompt = build_user_prompt(diff[:32000], comments)
    user_prompt += "\n\nPlease fetch 'src/vs/platform/browserView/browser/browserViewService.ts' to understand the surrounding code of the changes."
    print("\n====== USER PROMPT ======")
    print("User prompt built (showing first 500 chars):")
    print(user_prompt[:500] + "...")

    print("\n====== AGENT START ======")
    
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    interaction_count = 0
    max_interactions = 5

    while interaction_count < max_interactions:
        interaction_count += 1
        
        try:
            response = client.chat.completions.create(
                model="google/gemini-2.0-flash-001",
                messages=messages,
                tools=TOOLS,
                tool_choice="auto"
            )
        except Exception as e:
            print(f"❌ Error calling LLM: {e}")
            break

        message = response.choices[0].message
        messages.append(message) # Keep history

        # If the model wants to call a tool
        if message.tool_calls:
            for tool_call in message.tool_calls:
                arguments = json.loads(tool_call.function.arguments)
                print(f"\n🔧 TOOL CALL: {tool_call.function.name}")
                print(f"   Args: {arguments}")

                result = get_github_file(
                    owner=arguments["owner"],
                    repo=arguments["repo"],
                    filepath=arguments["filepath"],
                    ref=arguments.get("ref", "main")
                )
                
                # Truncate result for display if it's long
                display_result = result[:200] + "..." if len(result) > 200 else result
                print(f"   Result: {display_result}")

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result
                })
        else:
            # No tool calls, this is the final answer
            print("\n====== FINAL RESPONSE ======")
            print(message.content)
            break
    
    if interaction_count >= max_interactions:
        print("\n⚠️ Reached maximum interaction limit.")
