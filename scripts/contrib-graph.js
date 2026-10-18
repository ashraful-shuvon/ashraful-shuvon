// Builds assets/contrib-graph.svg: a neon, game-styled copy of the GitHub contribution calendar.
// Usage: node scripts/contrib-graph.js <github-username> [output.svg]
const fs = require('fs');
const path = require('path');

const user = process.argv[2] || 'ashraful-shuvon';
const outFile = process.argv[3] || path.join(__dirname, '..', 'assets', 'contrib-graph.svg');
const FONT = "'Courier New',Courier,monospace";
const COLORS = ['#1a1445', '#0e4f6e', '#1b8fa6', '#00F5FF', '#FF00C8'];

async function load() {
  const res = await fetch(`https://github.com/users/${user}/contributions`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  const html = await res.text();
  const tips = {};
  for (const m of html.matchAll(/<tool-tip[^>]*\sfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = m[2].match(/^(\d+) contribution/);
    tips[m[1]] = n ? +n[1] : 0;
  }
  const days = [];
  for (const m of html.matchAll(/<td[^>]*data-date="([^"]+)"[^>]*id="([^"]+)"[^>]*data-level="(\d)"/g)) {
    days.push({ date: m[1], level: +m[3], count: tips[m[2]] || 0 });
  }
  if (!days.length) throw new Error('No contribution cells found');
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function stats(days) {
  const total = days.reduce((s, d) => s + d.count, 0);
  const best = Math.max(...days.map((d) => d.count));
  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0, i = days.length - 1;
  if (days[i].count === 0) i--; // today may not have a contribution yet
  for (; i >= 0 && days[i].count > 0; i--) current++;
  return { total, best, longest, current };
}

function render(days) {
  const s = stats(days);
  const CELL = 12, PITCH = 15, LEFT = 46, TOP = 78;
  const t0 = Date.parse(days[0].date + 'T00:00:00Z');
  const sunday0 = t0 - new Date(t0).getUTCDay() * 86400000;
  const cols = [];
  let cells = '', months = '', lastMonthCol = -9, lastMonth = -1;
  days.forEach((d) => {
    const t = Date.parse(d.date + 'T00:00:00Z');
    const dow = new Date(t).getUTCDay();
    const col = Math.floor((t - sunday0) / (7 * 86400000));
    const x = LEFT + col * PITCH, y = TOP + dow * PITCH;
    const label = `${d.count} contribution${d.count === 1 ? '' : 's'} on ${d.date}`;
    cells += `<rect class="c" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${COLORS[d.level]}" style="animation-delay:${(col * 0.09).toFixed(2)}s"><title>${label}</title></rect>`;
    const mo = new Date(t).getUTCMonth();
    if (dow === 0 && mo !== lastMonth && col - lastMonthCol >= 3) {
      months += `<text x="${x}" y="${TOP - 10}" font-size="12" fill="#9fb4ff">${new Date(t).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}</text>`;
      lastMonth = mo; lastMonthCol = col;
    }
    cols.push(col);
  });
  const W = LEFT + (Math.max(...cols) + 1) * PITCH + 24, H = TOP + 7 * PITCH + 46;
  const dayLabels = [['Mon', 1], ['Wed', 3], ['Fri', 5]].map(([n, r]) => `<text x="10" y="${TOP + r * PITCH + 10}" font-size="12" fill="#9fb4ff">${n}</text>`).join('');
  const legend = COLORS.map((c, i) => `<rect x="${W - 24 - 36 - (5 - i) * 17}" y="${H - 26}" width="12" height="12" rx="2" fill="${c}"/>`).join('');
  const stat = (x, label, value, color) => `<text x="${x}" y="30" font-size="11" fill="#FF9EEB" letter-spacing="2">${label}</text><text x="${x}" y="52" font-size="20" fill="${color}">${value}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${s.total} contributions in the last year">
<title>${s.total} contributions in the last year</title>
<style>
text{font-family:${FONT};font-weight:bold}
.c{animation:wave 10s ease-in-out infinite}
@keyframes wave{0%{opacity:.2}6%{opacity:1}92%{opacity:1}100%{opacity:.2}}
.hd{animation:fl 5s linear infinite}@keyframes fl{0%,90%,100%{opacity:1}92%{opacity:.6}94%{opacity:1}}
</style>
<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="12" fill="#0F0C29" stroke="#FF00C8" stroke-width="3"/>
<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="9" fill="none" stroke="#00F5FF" stroke-opacity=".5"/>
<g class="hd"><text x="24" y="30" font-size="11" fill="#FF9EEB" letter-spacing="2">XP EARNED / LAST 12 MONTHS</text><text x="24" y="52" font-size="20" fill="#00F5FF">${s.total} CONTRIBUTIONS</text></g>
${stat(W - 520, 'CURRENT STREAK', s.current + ' DAYS', '#39FF14')}${stat(W - 370, 'BEST STREAK', s.longest + ' DAYS', '#FFE600')}${stat(W - 220, 'BEST DAY', s.best + ' COMMITS', '#FF00C8')}
${months}${dayLabels}
${cells}
<text x="${LEFT}" y="${H - 15}" font-size="12" fill="#9fb4ff">Learn how we count contributions</text>
<text x="${W - 24 - 36 - 5 * 17 - 4}" y="${H - 15}" text-anchor="end" font-size="12" fill="#9fb4ff">Less</text>${legend}
<text x="${W - 24}" y="${H - 15}" text-anchor="end" font-size="12" fill="#9fb4ff">More</text>
</svg>`;
}

load().then((days) => {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, render(days));
  console.log(`wrote ${outFile} (${days.length} days)`, stats(days));
}).catch((e) => { console.error(e.message); process.exit(1); });
