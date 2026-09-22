with open('admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace literal newlines inside split(' ... ') with \n
# We can find split('\n') where the \n is a literal newline
target1 = "split('\n')[0];"
replacement1 = r"split('\n')[0];"

content = content.replace(target1, replacement1)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(content)
