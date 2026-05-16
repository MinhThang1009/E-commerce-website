import sys
with open(sys.argv[1], encoding='utf-8') as f:
    lines = f.readlines()
result = []
for line in lines:
    if line.startswith('pick '):
        parts = line.split(' ', 2)
        subject = parts[2].strip() if len(parts) > 2 else ''
        if subject.startswith('Bugfix') or subject.startswith('Fix Phase'):
            result.append('reword ' + parts[1] + ' ' + subject + '\n')
        else:
            result.append(line)
    else:
        result.append(line)
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    f.writelines(result)
