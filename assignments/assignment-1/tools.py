import os
import subprocess
import shutil

def read_file(file_path: str, start_line: int = None, end_line: int = None) -> str:
    """Reads a file from disk with optional line range and size limits."""
    if not os.path.exists(file_path):
        return f"Error: File '{file_path}' not found."
    
    try:
        # Check file size to avoid token overflow (e.g., 1MB limit for safety)
        if os.path.getsize(file_path) > 1_000_000:
            return f"Error: File '{file_path}' is too large to read (limit 1MB)."

        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
            
            if start_line is not None and end_line is not None:
                # 1-indexed to 0-indexed
                content = "".join(lines[max(0, start_line-1):end_line])
            else:
                content = "".join(lines)
                
            # Final safety check on string length (approx tokens)
            if len(content) > 50000:
                return content[:50000] + "\n... [TRUNCATED DUE TO LENGTH] ..."
            return content
    except Exception as e:
        return f"Error reading file: {str(e)}"

def grep_codebase(search_pattern: str) -> str:
    """Recursively searches the codebase for a pattern. Uses ripgrep/grep if available, else a Python fallback."""
    executable = shutil.which("rg") or shutil.which("grep")
    
    if executable:
        cmd = [executable, "-r", search_pattern, "."]
        if "rg" in executable:
            cmd = [executable, "--line-number", search_pattern, "."]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.stdout:
                return result.stdout[:10000]
        except:
            pass

    # Python Fallback
    matches = []
    for root, _, files in os.walk("."):
        for file in files:
            if file.endswith((".py", ".ts", ".js", ".md")):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8', errors='replace') as f:
                        for i, line in enumerate(f, 1):
                            if search_pattern in line:
                                matches.append(f"{path}:{i}:{line.strip()}")
                except:
                    continue
    
    output = "\n".join(matches)
    if not output:
        return "No matches found."
    return output[:10000]

def get_file_history(file_path: str) -> str:
    """Gets recent git history for a file."""
    try:
        # Check if file exists and is tracked
        result = subprocess.run(["git", "log", "-p", "-n", "3", "--", file_path], 
                               capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return f"No history available (file is new or untracked). Error: {result.stderr.strip()}"
        return result.stdout or "No history available (file is new or untracked)."
    except Exception as e:
        return f"Error getting history: {str(e)}"
