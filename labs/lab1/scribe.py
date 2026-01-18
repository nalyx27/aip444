import os
import sys
import subprocess
from dotenv import load_dotenv, find_dotenv
from openai import OpenAI
import openai

print("Git Scribe - Developed by Dylan Navarrete - 107901225")
print("--------------------------------------------------------------")

# Load environment variables
load_dotenv(find_dotenv())
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemini-2.0-flash-exp:free")

if not OPENROUTER_API_KEY:
    print("❌ Error: OPENROUTER_API_KEY not found")
    sys.exit(1)

# Detect creative mode
is_creative = "--creative" in sys.argv

# Get staged git diff
try:
    result = subprocess.run(
        ["git", "diff", "--staged"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True
    )
    diff = result.stdout.strip()

    if not diff:
        print("❌ No staged changes found")
        sys.exit(1)

    print(f"✅ Diff found: {len(diff)} characters")

except subprocess.CalledProcessError:
    print("❌ Not a git repository")
    sys.exit(1)

# OpenRouter client (OpenAI-compatible)
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY
)

# Prompt + parameters
if is_creative:
    temperature = 1.2
    system_prompt = (
        "You are a 17th century pirate. "
        "Write a git commit message in pirate slang. "
        "Output ONLY the commit message. No explanation."
    )
else:
    temperature = 0.1
    system_prompt = (
        "You are an LLM that writes git commit messages. "
        "Given a git diff, output ONLY a Conventional Commit message "
        "(e.g., 'feat: add logging'). No explanation."
    )

# Call the LLM
try:
    response = client.chat.completions.create(
        model=LLM_MODEL,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": diff}
        ]
    )
except openai.RateLimitError:
    print(f"❌ Rate Limit Error: The model '{LLM_MODEL}' is currently rate limited.")
    print("Please try again later or switch to a different model using the LLM_MODEL environment variable.")
    sys.exit(1)

commit_message = response.choices[0].message.content.strip()

print("\n📝 Suggested Commit Message:\n")
print(commit_message)
