import re

with open('js/data.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

in_registros = False
new_lines = []
removed_urls = 0

for line in lines:
    if '"registrosDerivados": [' in line:
        in_registros = True
        new_lines.append(line)
        continue
    if in_registros and line.strip().startswith(']'):
        in_registros = False
        new_lines.append(line)
        continue
    if in_registros:
        if '"sharepointUrl":' in line or '"downloadUrl":' in line:
            removed_urls += 1
            continue
    new_lines.append(line)

content = ''.join(new_lines)

# Fix parent URL in doc-053-fmt-015 to point to the real physical SharePoint file
content = content.replace(
    'Formatos/FMT-GIC-015 Definición de criterios de formación.docx',
    'Formatos/FMT-GIC-016 Definición de criterios de formación.docx'
)

# Clean trailing commas before closing braces in JSON-like objects
content = re.sub(r',\s*(\n\s*})', r'\1', content)

with open('js/data.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Removed {removed_urls} static URLs from registrosDerivados. Parent URL aligned.')
