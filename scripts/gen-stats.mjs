// Builds assets/top-langs-{dark,light}.svg from the public, non-fork repositories of the profile owner.
// Runs weekly in GitHub Actions; only public data is read.
import { writeFileSync, mkdirSync } from 'node:fs';

const user = process.env.PROFILE_USER || 'dark-anishi';
const token = process.env.GITHUB_TOKEN;
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'profile-stats' };
if (token) headers.Authorization = 'Bearer ' + token;

async function api(path) {
  const res = await fetch('https://api.github.com' + path, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
  return res.json();
}

const COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', 'C#': '#178600', Python: '#3572A5', Rust: '#dea584',
  PowerShell: '#012456', HTML: '#e34c26', CSS: '#663399', NSIS: '#8a8a8a', Shell: '#89e051', GLSL: '#5686a5',
};
const IGNORE = new Set(['NSIS']);

const repos = (await api(`/users/${user}/repos?per_page=100&type=owner`)).filter(r => !r.fork && !r.archived && r.name !== user);
const totals = {};
for (const repo of repos) {
  for (const [lang, bytes] of Object.entries(await api(`/repos/${repo.full_name}/languages`))) {
    if (!IGNORE.has(lang)) totals[lang] = (totals[lang] || 0) + bytes;
  }
}
const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
let langs = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([name, bytes]) => ({ name, pct: (bytes / sum) * 100 }));
if (langs.length > 6) {
  const rest = langs.slice(5).reduce((a, l) => a + l.pct, 0);
  langs = [...langs.slice(0, 5), { name: 'Other', pct: rest }];
}
const stars = repos.reduce((a, r) => a + r.stargazers_count, 0);

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function card(theme) {
  const t = theme === 'dark'
    ? { bg: '#0d1117', border: '#30363d', title: '#f0f6fc', text: '#c9d1d9', muted: '#8b949e', track: '#21262d' }
    : { bg: '#ffffff', border: '#d0d7de', title: '#1f2328', text: '#1f2328', muted: '#59636e', track: '#eaeef2' };
  const W = 495, H = 195, X = 25, BW = W - 50;
  let x = X, bar = '';
  for (const l of langs) {
    const w = Math.max((l.pct / 100) * BW, 2);
    bar += `<rect x="${x.toFixed(2)}" y="62" width="${w.toFixed(2)}" height="8" fill="${COLORS[l.name] || t.muted}"/>`;
    x += w;
  }
  const legend = langs.map((l, i) => {
    const cx = X + (i % 2) * 225, cy = 100 + Math.floor(i / 2) * 26;
    return `<circle cx="${cx + 5}" cy="${cy - 4}" r="5" fill="${COLORS[l.name] || t.muted}"/>` +
      `<text x="${cx + 18}" y="${cy}" class="t">${esc(l.name)} <tspan class="m">${l.pct.toFixed(1)}%</tspan></text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Most used languages">
<style>.h{font:600 17px 'Segoe UI',Ubuntu,sans-serif;fill:${t.title}}.t{font:400 13px 'Segoe UI',Ubuntu,sans-serif;fill:${t.text}}.m{fill:${t.muted}}.s{font:400 11px 'Segoe UI',Ubuntu,sans-serif;fill:${t.muted}}</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" fill="${t.bg}" stroke="${t.border}"/>
<text x="${X}" y="36" class="h">Most used languages</text>
<text x="${W - 25}" y="36" class="s" text-anchor="end">${repos.length} public repo${repos.length === 1 ? '' : 's'} · ★ ${stars}</text>
<clipPath id="c"><rect x="${X}" y="62" width="${BW}" height="8" rx="4"/></clipPath>
<rect x="${X}" y="62" width="${BW}" height="8" rx="4" fill="${t.track}"/><g clip-path="url(#c)">${bar}</g>
${legend}
</svg>
`;
}

mkdirSync('assets', { recursive: true });
for (const theme of ['dark', 'light']) writeFileSync(`assets/top-langs-${theme}.svg`, card(theme));
console.log(langs.map(l => `${l.name} ${l.pct.toFixed(1)}%`).join(', '));
