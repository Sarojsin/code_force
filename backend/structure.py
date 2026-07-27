import os

IGNORE_DIRS = {
    '.git', '.venv', '__pycache__', '.pytest_cache',
    '.idea', '.vscode', 'node_modules',
    'site-packages', 'venv', 'env', '.next', 'dist', 'build'
}

IGNORE_FILES = {
    '.DS_Store', 'tree.txt', 'your_structure.txt', 'server.log'
}

FOLDER_EMOJI = {
    'app': '📱',
    'api': '🔌',
    'core': '🎯',
    'services': '🧠',
    'routes': '🔀',
    'controllers': '🎮',
    'models': '🗄️',
    'schemas': '📐',
    'repositories': '💼',
    'middleware': '🔐',
    'utils': '🔧',
    'helpers': '🛠️',
    'config': '⚙️',
    'database': '🗂️',
    'migrations': '🗃️',
    'modules': '🧩',
    'integrations': '🔌',
    'tasks': '📋',
    'tests': '🧪',
    'scripts': '📜',
    'docs': '📚',
    'media': '🖼️',
    'logs': '📜',
    'alembic': '🗃️',
    'storage': '🗄️',
    'plans': '📋',
    'assets': '🖼️',
}

FILE_EMOJI = {
    '.py': '🐍',
    '.js': '🟨',
    '.jsx': '⚛️',
    '.ts': '🟦',
    '.tsx': '⚛️',
    '.json': '🧾',
    '.yaml': '🧾',
    '.yml': '🧾',
    '.md': '📝',
    '.txt': '📄',
    '.ini': '⚙️',
    '.sql': '🗃️',
    '.toml': '⚙️',
    '.env': '🔐',
    '.lock': '🔒',
    '.log': '📜',
    '.dockerfile': '🐳',
    '.gitignore': '🙈',
    '.example': '📋',
}


def folder_emoji(name):
    return FOLDER_EMOJI.get(name.lower(), '📂')


def file_emoji(filename):
    lower = filename.lower()
    if lower == 'dockerfile':
        return '🐳'
    if lower in {'package.json', 'package-lock.json'}:
        return '📦'
    if lower.endswith('.lock'):
        return '🔒'
    if lower in {'pyproject.toml', 'poetry.lock'}:
        return '📦'
    if lower in {'requirements.txt', 'requirements-dev.txt'}:
        return '📋'
    if lower.startswith('.env'):
        return '🔐'
    if lower.endswith('.md'):
        return '📝'
    _, ext = os.path.splitext(lower)
    return FILE_EMOJI.get(ext, '📄')


def print_tree(path, prefix='', out=None):
    try:
        items = os.listdir(path)
    except PermissionError:
        return

    items = [
        i for i in items
        if i not in IGNORE_DIRS
        and i not in IGNORE_FILES
        and not i.endswith('.pyc')
    ]

    items.sort()
    dirs = [i for i in items if os.path.isdir(os.path.join(path, i))]
    files = [i for i in items if os.path.isfile(os.path.join(path, i))]
    entries = dirs + files

    for index, item in enumerate(entries):
        full_path = os.path.join(path, item)
        is_last = index == len(entries) - 1
        connector = '└── ' if is_last else '├── '

        if os.path.isdir(full_path):
            icon = folder_emoji(item)
            line = f"{prefix}{connector}{icon} {item}/"
        else:
            icon = file_emoji(item)
            line = f"{prefix}{connector}{icon} {item}"

        out.write(line + '\n')

        if os.path.isdir(full_path):
            extension = '    ' if is_last else '│   '
            print_tree(full_path, prefix + extension, out)


if __name__ == "__main__":
    with open('backend_structure_tree.md', 'w', encoding='utf-8') as f:
        f.write("backend/\n")
        print_tree('backend', '', f)
