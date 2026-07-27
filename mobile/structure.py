import os

IGNORE_DIRS = {
    '.git', '.venv', '__pycache__', '.pytest_cache',
    '.idea', '.vscode', 'node_modules',
    'site-packages', 'venv', 'env', '.next', 'dist', 'build',
    '.expo', '.husky', 'coverage', 'android', 'ios', 'patches'
}

IGNORE_FILES = {
    '.DS_Store', 'tree.txt', 'your_structure.txt', 'server.log',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
}

FOLDER_EMOJI = {
    'app': '📱',
    'src': '📦',
    'components': '🧩',
    'screens': '📄',
    'navigation': '🧭',
    'stores': '🗃️',
    'services': '🔌',
    'api': '🌐',
    'db': '🗄️',
    'theme': '🎨',
    'utils': '🔧',
    'hooks': '🪝',
    'validation': '✅',
    'types': '📐',
    'constants': '📏',
    'assets': '🖼️',
    'models': '🤖',
    'docs': '📚',
    'e2e': '🧪',
    'business': '💼',
    'ui': '🎨',
    'localDb': '💾',
    'ml': '🧠',
    'queries': '🔍',
    'sync': '🔄',
    'providers': '🔌',
    'admin': '👨‍💼',
    'analytics': '📊',
    'auth': '🔐',
    'calendar': '📅',
    'chat': '💬',
    'cycle': '🌸',
    'dev': '🛠️',
    'family': '👨‍👩‍👧',
    'home': '🏠',
    'nurse_content': '👩‍⚕️',
    'onboarding': '🚀',
    'pregnancy': '🤰',
    'profile': '👤',
    'safety': '🛡️',
    'voice': '🎙️',
    'wellness': '🌿',
}

FILE_EMOJI = {
    '.ts': '📘',
    '.tsx': '⚛️',
    '.js': '📗',
    '.jsx': '⚛️',
    '.json': '🧾',
    '.md': '📝',
    '.txt': '📄',
    '.tsconfig': '⚙️',
    '.env': '🔐',
    '.log': '📜',
    '.sql': '🗃️',
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.svg': '🖌️',
    '.gif': '🎞️',
    '.mp4': '🎬',
    '.mp3': '🎵',
    '.wav': '🎵',
    '.onnx': '🤖',
    '.json': '🧾',
    '.yaml': '🧾',
    '.yml': '🧾',
    '.lock': '🔒',
}


def folder_emoji(name):
    return FOLDER_EMOJI.get(name.lower(), '📂')


def file_emoji(filename):
    lower = filename.lower()
    if lower in {'app.tsx', 'app.jsx'}:
        return '🚀'
    if lower in {'package.json'}:
        return '📦'
    if lower.endswith('.lock'):
        return '🔒'
    if lower in {'tsconfig.json', 'babel.config.js'}:
        return '⚙️'
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
    with open('mobile_structure_tree.md', 'w', encoding='utf-8') as f:
        f.write("mobile/\n")
        print_tree('mobile', '', f)
