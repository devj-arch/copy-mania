import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

type Settings = {
  ignoreNames: string[];
  maxOutputBytes: number;
  skipLikelyBinary: boolean;
};

function shouldIgnore(relPath: string, ignoreList: string[]): boolean {
  return ignoreList.some(pattern => {
    if (!pattern.includes('*')) {
      return relPath === pattern;
    }
    const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$", "i");
    return re.test(relPath);
  });
}

// Entry Point
export function activate(context: vscode.ExtensionContext) {
  const copyRecursive = vscode.commands.registerCommand('copyFolderContents.copyRecursive', async (uri: vscode.Uri) => {
    await runCopy(uri, { recursive: true });
  });

  const copyTopLevel = vscode.commands.registerCommand('copyFolderContents.copyTopLevel', async (uri: vscode.Uri) => {
    await runCopy(uri, { recursive: false });
  });

  context.subscriptions.push(copyRecursive, copyTopLevel);
}

// Heart
async function runCopy(uri: vscode.Uri, opts: { recursive: boolean }) {
  try {
    if (!uri) {
      vscode.window.showErrorMessage('Please right-click a folder in the Explorer.');
      return;
    }
    const stat = await fsp.stat(uri.fsPath);
    if (!stat.isDirectory()) {
      vscode.window.showErrorMessage('Selected item is not a folder.');
      return;
    }

    const cfg = vscode.workspace.getConfiguration('copyFolderContents');
    const settings: Settings = {
      ignoreNames: cfg.get<string[]>('ignoreNames', []), // VS Code fills in defaults
      maxOutputBytes: cfg.get<number>('maxOutputBytes', 1_000_000),
      skipLikelyBinary: cfg.get<boolean>('skipLikelyBinary', true),
    };


    const root = uri.fsPath;

    // If recursive, let the user deselect immediate subfolders (default = all selected)
    let allowedSubdirs: Set<string> | null = null;
    if (opts.recursive) {
      const immediateSubdirs = (await fsp.readdir(root, { withFileTypes: true }))
        .filter(d => d.isDirectory() && !settings.ignoreNames.includes(d.name))
        .map(d => d.name);

      if (immediateSubdirs.length > 0) {
        const items: vscode.QuickPickItem[] = immediateSubdirs.map(name => ({ label: name, picked: true }));
        const picked = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: 'Select subfolders to include (default: all). Unselect to exclude.',
          ignoreFocusOut: true
        });
        // If user cancels, keep default (all). Else, use chosen set (can be empty to include top-level only).
        if (picked) {
          allowedSubdirs = new Set(picked.map(p => p.label));
        }
      }
    }

    const output = await vscode.window.withProgress<string>({
      location: vscode.ProgressLocation.Notification,
      title: 'Collecting folder contents…',
      cancellable: true
    }, async (progress, token) => {
      const files: string[] = [];
      const startTime = Date.now();

      const walk = async (dir: string, relBase: string = ''): Promise<void> => {
        if (token.isCancellationRequested) return;

        const entries = await fsp.readdir(dir, { withFileTypes: true });

        for (const e of entries) {
          if (token.isCancellationRequested) return;

          const full = path.join(dir, e.name);
          const rel = path.posix.join(relBase, e.name);

          // Ignore by name anywhere in the path
          if (shouldIgnore(rel, settings.ignoreNames)) continue;

          if (e.isDirectory()) {
            // If at root depth and recursive, honor subdir selection
            if (dir === root && allowedSubdirs && !allowedSubdirs.has(e.name)) {
              continue;
            }
            if (opts.recursive) {
              await walk(full, rel);
            }
          } else if (e.isFile()) {
            files.push(full);
          }
        }
      };

      await walk(root, '');

      progress.report({ message: `Reading ${files.length} files…` });

      // Build formatted output
      let combined = '';
      let totalBytes = 0;

      for (let i = 0; i < files.length; i++) {
        if (token.isCancellationRequested) break;

        const file = files[i];
        const rel = path.relative(root, file).split(path.sep).join('/');

        // Peek first chunk to detect likely binary
        const fd = await fsp.open(file, 'r');
        const head = Buffer.alloc(1024);
        let isBinary = false;
        try {
          const { bytesRead } = await fd.read(head, 0, 1024, 0);
          for (let j = 0; j < bytesRead; j++) {
            if (head[j] === 0) { isBinary = true; break; }
          }
        } finally {
          await fd.close();
        }
        if (isBinary && settings.skipLikelyBinary) {
          continue; // skip likely binary files
        }

        const content = await fsp.readFile(file, 'utf8');
        const lang = languageFromExt(path.extname(file).toLowerCase());

        const header = `--- file: ${rel} ---`;
        const fenced = `\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
        const block = `\n${header}${fenced}`;

        combined += block;
        totalBytes += Buffer.byteLength(block, 'utf8');

        if (i % 25 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          progress.report({ message: `Processed ${i + 1}/${files.length} files (${elapsed}s)…` });
        }
      }

      return combined;
    });

    // Warn if too big
    const total = Buffer.byteLength(output, 'utf8');
    if (total > settings.maxOutputBytes) {
      const choice = await vscode.window.showWarningMessage(
        `Output is large (${formatBytes(total)} > ${formatBytes(settings.maxOutputBytes)}). Proceed?`,
        { modal: true },
        'Yes', 'No'
      );
      if (choice !== 'Yes') return;
    }

    // Choose action
    const action = await vscode.window.showQuickPick(
      ['Copy to Clipboard', 'Export to File'],
      { placeHolder: 'What do you want to do with the structured output?' }
    );

    if (!action) return;

    if (action === 'Copy to Clipboard') {
      await vscode.env.clipboard.writeText(output);
      vscode.window.showInformationMessage('Folder contents copied to clipboard.');
    } else {
      const defaultName = path.basename(root) + '-' + nowStamp() + '-structured.md';
      const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(root, defaultName)),
        filters: { 'Markdown/Text': ['md', 'txt'] }
      });
      if (!target) return;
      await fsp.writeFile(target.fsPath, output, 'utf8');
      vscode.window.showInformationMessage('Folder contents exported.');
    }
  } catch (err: any) {
    console.error(err);
    vscode.window.showErrorMessage(`Copy Folder Contents: ${err.message ?? err}`);
  }
}

function languageFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.js': 'javascript', '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx',
    '.json': 'json', '.md': 'markdown', '.yml': 'yaml', '.yaml': 'yaml',
    '.toml': 'toml', '.ini': 'ini', '.env': '',
    '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
    '.vue': 'vue', '.svelte': 'svelte',
    '.py': 'python', '.rb': 'ruby', '.php': 'php', '.go': 'go', '.rs': 'rust',
    '.java': 'java', '.kt': 'kotlin', '.swift': 'swift',
    '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
    '.cs': 'csharp', '.sql': 'sql', '.sh': 'bash', '.ps1': 'powershell',
    '.r': 'r', '.pl': 'perl', '.lua': 'lua', '.dart': 'dart',
    '.xml': 'xml'
  };
  return map[ext] ?? '';
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function deactivate() {}
