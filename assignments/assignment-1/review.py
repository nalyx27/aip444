import argparse
import subprocess
import sys
import os
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from tools import read_file, grep_codebase, get_file_history
from agents import Reviewer

load_dotenv()

async def run_reviewer(reviewer, content, filename, mode, verbose, tool_handler):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, reviewer.review, content, filename, mode, verbose, tool_handler)

def tool_handler(name, args):
    if name == "read_file":
        return read_file(**args)
    elif name == "grep_codebase":
        return grep_codebase(**args)
    elif name == "get_file_history":
        return get_file_history(**args)
    return f"Error: Tool {name} not found."

async def main():
    parser = argparse.ArgumentParser(description="AI Code Review CLI Tool")
    parser.add_argument("--file", help="File to review")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    args = parser.parse_args()

    content = ""
    mode = ""

    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: File '{args.file}' not found.")
            sys.exit(1)
        with open(args.file, 'r', encoding='utf-8') as f:
            content = f.read()
        mode = "File"
    else:
        # Git Mode
        try:
            result = subprocess.run(["git", "diff", "--staged"], capture_output=True, text=True)
            content = result.stdout.strip()
            if not content:
                print("No staged changes to review.")
                sys.exit(0)
            mode = "Git"
        except Exception as e:
            print(f"Error checking git changes: {e}")
            sys.exit(1)

    # Initialize Reviewers
    security_auditor = Reviewer(
        "Security Auditor", 
        "Paranoid, strict, and unyielding. Treats every line of code as a potential vector for attack. Scans for vulnerabilities (SQL injection, XSS), hardcoded secrets, and missing permission checks."
    )
    maintainability_critic = Reviewer(
        "Maintainability Critic",
        "Obsessed with 'Clean Code', naming conventions, and the DRY principle. Hates messy formatting. Focuses on readability, function length, and refactoring."
    )

    if args.verbose:
        print(f"Running parallel reviews for {mode} mode...", file=sys.stderr)

    # Parallel Execution
    results = await asyncio.gather(
        run_reviewer(security_auditor, content, args.file or "staged_changes", mode, args.verbose, tool_handler),
        run_reviewer(maintainability_critic, content, args.file or "staged_changes", mode, args.verbose, tool_handler)
    )

    # Structured findings
    reviewer1_findings = results[0]
    reviewer2_findings = results[1]

    if args.verbose:
        print("\n[Security Auditor Findings]:", file=sys.stderr)
        print(json.dumps(reviewer1_findings, indent=2), file=sys.stderr)
        print("\n[Maintainability Critic Findings]:", file=sys.stderr)
        print(json.dumps(reviewer2_findings, indent=2), file=sys.stderr)

    # Lead Dev Synthesis
    lead_dev = Reviewer(
        "Lead Developer",
        "Extremely experienced, pragmatic, empathetic but firm. Goal: De-duplicate, filter hallucinations, resolve conflicts, and format into a clean Markdown report."
    )
    
    synthesis_payload = f"""Here are the raw findings from two reviewers:

Reviewer 1 (Security):
{json.dumps(reviewer1_findings, indent=2)}

Reviewer 2 (Maintainability):
{json.dumps(reviewer2_findings, indent=2)}

Please synthesize these into a final, actionable Markdown report.
Deduplicate if both found the same issue. 
Filter out minor nits or hallucinations.
Make it human-readable and professional.
"""

    if args.verbose:
        print("\n[Lead Developer] Synthesizing report...", file=sys.stderr)

    # Lead dev doesn't use tools in this simplified implementation for synthesis
    final_report_msg = lead_dev._call_llm([
        {"role": "system", "content": lead_dev.persona},
        {"role": "user", "content": synthesis_payload}
    ])
    
    print(final_report_msg.get("content", "Error generating report."))

if __name__ == "__main__":
    asyncio.run(main())
