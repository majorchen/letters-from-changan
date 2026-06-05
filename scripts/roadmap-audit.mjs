import { readFile } from 'node:fs/promises';

const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const unchecked = changelog
  .split('\n')
  .map((line, index) => ({ line: index + 1, text: line.trim() }))
  .filter((item) => item.text.startsWith('- [ ]'));

const categories = [
  {
    name: 'external',
    test: (text) => /付费|用户系统|云存档|视频|Agnes video|ffmpeg/.test(text),
  },
  {
    name: 'content',
    test: (text) => /全通|拼图|啊哈|角色线|真相|动机|内容收束|三幕节奏/.test(text),
  },
  {
    name: 'validation',
    test: (text) => /验证|压测|试玩|反馈|观察|确认|fallback/.test(text),
  },
];

const counts = Object.fromEntries(categories.map((category) => [category.name, 0]));
for (const item of unchecked) {
  const category = categories.find((candidate) => candidate.test(item.text));
  if (category) counts[category.name] += 1;
}

console.log(`unchecked=${unchecked.length}`);
console.log(`validation=${counts.validation}`);
console.log(`content=${counts.content}`);
console.log(`external=${counts.external}`);
console.log('');
for (const item of unchecked) {
  console.log(`${item.line}: ${item.text}`);
}
