"""
Rewrite small commit messages: replace '- ' bullets with '1. 2. 3.' numbering.
Covers: Bugfix, Fix, Cập nhật, Thêm, Bổ sung commits — full history.
Uses git plumbing (commit-tree) to avoid interactive rebase.
Usage: python scripts/rewrite_commits.py [--dry-run]
"""
import subprocess, re, sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = '--dry-run' in sys.argv

def git(*args, input=None):
    r = subprocess.run(['git'] + list(args), capture_output=True, text=True,
                       encoding='utf-8', cwd=REPO, input=input)
    if r.returncode != 0:
        print(f'git {args} failed: {r.stderr}', file=sys.stderr)
        sys.exit(1)
    return r.stdout.strip()

def number_bullets(body):
    lines = body.split('\n')
    # Có subsections N.X. → là phase completion commit, bỏ qua
    if any(re.match(r'^\d+\.\d+\. ', l) for l in lines):
        return body
    counter = 0
    result = []
    for line in lines:
        if line.startswith('- '):
            counter += 1
            line = str(counter) + '. ' + line[2:]
        result.append(line)
    return '\n'.join(result)

def is_small_commit(subject):
    prefixes = ('Bugfix', 'Fix ', 'Cập nhật', 'Thêm ', 'Bổ sung')
    return any(subject.startswith(p) for p in prefixes)

# Get ALL commits from root to HEAD, oldest first
log = git('log', '--format=%H', '--reverse')
hashes = [h for h in log.split('\n') if h]
print(f'Found {len(hashes)} commits to process{"  [DRY RUN]" if DRY_RUN else ""}')

# Map old hash -> new hash as we rebuild the chain
remap = {}

for h in hashes:
    tree     = git('log', '-1', '--format=%T', h)
    subject  = git('log', '-1', '--format=%s', h)
    body     = git('log', '-1', '--format=%b', h)
    an       = git('log', '-1', '--format=%an', h)
    ae       = git('log', '-1', '--format=%ae', h)
    ad       = git('log', '-1', '--format=%aI', h)
    cn       = git('log', '-1', '--format=%cn', h)
    ce       = git('log', '-1', '--format=%ce', h)
    cd       = git('log', '-1', '--format=%cI', h)

    # Build new message
    if is_small_commit(subject) and body:
        new_body = number_bullets(body)
    else:
        new_body = body

    new_msg = subject + ('\n\n' + new_body.strip() if new_body.strip() else '')
    old_full = subject + ('\n\n' + body.strip() if body.strip() else '')
    changed = new_msg != old_full

    # Dry run: chỉ in danh sách commit sẽ thay đổi, không commit-tree
    if DRY_RUN:
        if changed:
            print(f'  {h[:8]}  {subject[:65]}  ← reworded')
        continue

    # Remap parent
    parent_raw = git('log', '-1', '--format=%P', h)
    parents = parent_raw.split() if parent_raw else []
    new_parents = [remap.get(p, p) for p in parents]

    # Build commit-tree args
    ct_args = ['commit-tree', tree]
    for p in new_parents:
        ct_args += ['-p', p]
    ct_args += ['-m', new_msg]

    env = os.environ.copy()
    env.update({
        'GIT_AUTHOR_NAME': an, 'GIT_AUTHOR_EMAIL': ae, 'GIT_AUTHOR_DATE': ad,
        'GIT_COMMITTER_NAME': cn, 'GIT_COMMITTER_EMAIL': ce, 'GIT_COMMITTER_DATE': cd,
    })
    r = subprocess.run(['git'] + ct_args, capture_output=True, text=True,
                       encoding='utf-8', cwd=REPO, env=env)
    if r.returncode != 0:
        print(f'commit-tree failed: {r.stderr}', file=sys.stderr)
        sys.exit(1)
    new_h = r.stdout.strip()
    remap[h] = new_h
    tag = ' ← reworded' if changed else ''
    print(f'  {h[:8]} -> {new_h[:8]}  {subject[:55]}{tag}')

if DRY_RUN:
    print('\n[DRY RUN] Không thay đổi gì. Bỏ --dry-run để chạy thật.')
    sys.exit(0)

# Update branch ref to new HEAD
old_head = git('rev-parse', 'HEAD')
new_head = remap.get(old_head, old_head)
git('update-ref', 'refs/heads/main', new_head)
print(f'\nDone. HEAD: {old_head[:8]} -> {new_head[:8]}')
print('Run: git push --force-with-lease origin main')
