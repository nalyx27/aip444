import json
from typing import List, Dict, Any
import os
import requests

class Reviewer:
    def __init__(self, name: str, persona: str, model: str = "google/gemini-2.0-flash-001"):
        self.name = name
        self.persona = persona
        self.model = model
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1"

    def _call_llm(self, messages: List[Dict[str, str]], tools: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/nalyx27/aip444",
            "X-Title": "AI Code Review Assignment"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]

    def review(self, content: str, filename: str, mode: str, verbose: bool = False, tool_handler = None) -> List[Dict[str, Any]]:
        if verbose:
            print(f"[{self.name}] Starting review in {mode} mode for {filename}...", file=sys.stderr)

        system_prompt = f"""You are {self.name}. {self.persona}

        You will receive content from a file named '{filename}'.
        Your goal is to find issues and return them in a structured JSON format.
        
        Available tools:
        - read_file(file_path, start_line, end_line): Use this to see more context around a change.
        - grep_codebase(search_pattern): Use this to find definitions of functions or variables.
        - get_file_history(file_path): Use this to see past changes to a file.

        MANDATORY PROOF OF WORK: As part of the 'Golden Dataset Proof', you MUST call EACH of the following tools at least once before providing your final JSON findings:
        1. `read_file` (use '{filename}' as the file_path)
        2. `grep_codebase`
        3. `get_file_history` (use '{filename}' as the file_path)

        Failure to use all three tools will result in an incomplete review.
        
        RESPONSE FORMAT:
        You must first provide your reasoning for calling tools if needed.
        Once you have used all three tools and gathered information, provide your findings as an ARRAY of JSON objects:
        [
          {{
            "file": "{filename}",
            "line_number": 123,
            "severity": "critical|warn|info",
            "category": "security|style|logic|etc",
            "description": "Short explanation"
          }}
        ]
        
        If no issues are found, return an empty array [].
        Do not include any other text in the final response except the JSON array.
        """

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Review this {mode} content from {filename}:\n\n{content}"}
        ]

        # Simplified tool loop (max 5 iterations)
        for _ in range(5):
            message = self._call_llm(messages, tool_definitions)
            
            if not message.get("tool_calls"):
                # No more tool calls, attempt to extract JSON
                try:
                    # Look for JSON array in content
                    content = message.get("content", "")
                    # LLMs often wrap JSON in triple backticks
                    start = content.find("[")
                    end = content.rfind("]") + 1
                    if start != -1 and end != 0:
                        return json.loads(content[start:end])
                    return []
                except:
                    return []

            # Process tool calls
            messages.append(message)
            for tool_call in message["tool_calls"]:
                func_name = tool_call["function"]["name"]
                args = json.loads(tool_call["function"]["arguments"])
                
                if verbose:
                    print(f"[{self.name}] Calling tool {func_name}({args})...", file=sys.stderr)
                
                result = tool_handler(func_name, args)
                
                if verbose:
                    print(f"[{self.name}] Tool returned: {str(result)[:100]}...", file=sys.stderr)
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": func_name,
                    "content": str(result)
                })

        return []

tool_definitions = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read content of a file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string"},
                    "start_line": {"type": "integer"},
                    "end_line": {"type": "integer"}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "grep_codebase",
            "description": "Search codebase for a pattern",
            "parameters": {
                "type": "object",
                "properties": {
                    "search_pattern": {"type": "string"}
                },
                "required": ["search_pattern"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_file_history",
            "description": "Get git history for a file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string"}
                },
                "required": ["file_path"]
            }
        }
    }
]

import sys # Needed for stderr in Reviewer.review
