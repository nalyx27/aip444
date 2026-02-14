import requests

def get_github_file(owner, repo, filepath, ref="main", max_lines=500):
    """
    Fetch raw file content from GitHub and truncate if too large.
    """

    url = f"https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{filepath}"

    try:
        response = requests.get(url)

        if response.status_code == 404:
            return f"Error: File not found: {url}"

        response.raise_for_status()

        content = response.text
        lines = content.splitlines()

        if len(lines) > max_lines:
            truncated = "\n".join(lines[:max_lines])
            return f"{truncated}\n\n[File truncated: showing first {max_lines} of {len(lines)} lines]"

        return content

    except requests.exceptions.RequestException as e:
        return f"Error fetching file: {str(e)}"