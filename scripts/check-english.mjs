import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanDirectories = ['src', 'public', 'blender', 'scripts', 'tests'];
const scanRootFiles = ['index.html', 'README.md', 'package.json'];
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'validation', 'docs']);
const textExtensions = new Set([
  '.cjs', '.css', '.frag', '.glsl', '.html', '.js', '.json', '.md', '.mjs',
  '.py', '.svg', '.toml', '.ts', '.tsx', '.txt', '.vert', '.xml', '.yaml', '.yml',
]);
const japaneseScript = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu;

async function collectTextFiles(directory, files = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return files;
    throw error;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await collectTextFiles(fullPath, files);
    } else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = [];
for (const directory of scanDirectories) await collectTextFiles(path.join(root, directory), files);
for (const file of scanRootFiles) files.push(path.join(root, file));
files.sort((a, b) => a.localeCompare(b));

const findings = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  japaneseScript.lastIndex = 0;
  for (const match of source.matchAll(japaneseScript)) {
    const before = source.slice(0, match.index);
    const line = before.split('\n').length;
    const column = match.index - before.lastIndexOf('\n');
    const codePoint = match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    const relative = path.relative(root, file).split(path.sep).join('/');
    findings.push(`${relative}:${line}:${column}: U+${codePoint} ${JSON.stringify(match[0])}`);
  }
}

if (findings.length) {
  console.error(`Japanese-script characters found in ${findings.length} source location(s):`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error('This source scan does not inspect text embedded in image pixels or packed Blender images.');
  process.exitCode = 1;
} else {
  console.log(`English source scan passed (${files.length} text files checked).`);
  console.log('Image pixels and packed Blender images are checked separately; this script does not inspect them.');
}
