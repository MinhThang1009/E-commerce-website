"""
Phase 40.10 — Remove `brand` column from products INSERTs in seed_data.sql.
After Phase 40.7 dropped products.brand, the seed file references a non-existent column.
All `brand` values are NULL per DB audit (count_with_brand_value=0/45).

Run: python scripts/remove_brand_column.py
"""
import re
import sys

PATH = 'backend/data/seed_data.sql'

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

original_count = content.count('`brand`, `sku`')
print(f"Found {original_count} 'brand, sku' occurrences before edit")

# Step 1: column list — remove `brand` from products INSERT column list
content = content.replace('`deleted_at`, `brand`, `sku`)', '`deleted_at`, `sku`)')

def split_top_level_csv(s):
    """Split on top-level commas (skip ones inside quotes/parens)."""
    parts = []
    current = []
    depth = 0
    in_str = False
    escape = False
    for c in s:
        if escape:
            current.append(c)
            escape = False
            continue
        if c == '\\' and in_str:
            current.append(c)
            escape = True
            continue
        if c == "'" and not escape:
            in_str = not in_str
            current.append(c)
            continue
        if not in_str:
            if c in '([{':
                depth += 1
            elif c in ')]}':
                depth -= 1
        if c == ',' and depth == 0 and not in_str:
            parts.append(''.join(current).strip())
            current = []
        else:
            current.append(c)
    if current:
        last = ''.join(current).strip()
        if last:
            parts.append(last)
    return parts

VALUES_RE = re.compile(r'VALUES \((.*)\);')

def fix_products_values(line):
    if not line.startswith('INSERT INTO products'):
        return line, False
    m = VALUES_RE.search(line)
    if not m:
        return line, False
    values_str = m.group(1)
    parts = split_top_level_csv(values_str)
    if len(parts) < 2:
        return line, False
    brand_val = parts[-2]
    if brand_val != 'NULL':
        print(f"WARNING: brand value not NULL on row: {brand_val[:80]}")
    # Remove 2nd-to-last (brand), keep last (sku)
    new_parts = parts[:-2] + [parts[-1]]
    new_values_str = ', '.join(new_parts)
    new_line = line[:m.start()] + 'VALUES (' + new_values_str + ');' + line[m.end():]
    return new_line, True

new_lines = []
modified = 0
for line in content.split('\n'):
    new_line, changed = fix_products_values(line)
    if changed:
        modified += 1
    new_lines.append(new_line)

content = '\n'.join(new_lines)

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Modified {modified} products INSERT lines")
print(f"Remaining 'brand, sku' occurrences: {content.count('`brand`, `sku`')}")
sys.exit(0 if modified == 45 else 1)
