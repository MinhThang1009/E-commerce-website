import sys
with open(sys.argv[1], encoding='utf-8') as f:
    content = f.read()
lines = content.split('\n')
counter = 0
result = []
for line in lines:
    if line.startswith('- '):
        counter += 1
        line = str(counter) + '. ' + line[2:]
    result.append(line)
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    f.write('\n'.join(result))
