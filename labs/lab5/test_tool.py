from tools import get_github_file

print("Starting test...")

content = get_github_file(
    "microsoft",
    "vscode",
    "package.json",
    "main"
)

print("Response received.")
print("Type:", type(content))
print("Length:", len(content))
print("Preview:")
print(content[:500])