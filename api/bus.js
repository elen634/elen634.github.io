/* バス時刻表の取得元をまとめて調べる口。
   ・都営バス: 港南中学校前の のりば/方向 の組み合わせを総当たりし、
     品川駅へ向かう便がどれかと、曜日別の時刻表本体を返す
   ・ちぃばす: 東京都オープンデータカタログを検索して候補を返す
   取得は読み取りのみ。 */

const TOBUS = 'https://tobus.jp/sp/blsys/stop/time';

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .split(/\n/).map(s => s.trim()).filter(Boolean);
}

/* tobus.jp の時刻表は
     <tr class="hide_timetable" data-timetable="6"> … <td>23</td><td>33</td> …
   という形。data-timetable が「時」なので、時と分を取り違えずに読める。
   分のセルには行先の印（ﾆ 等）が付くことがあるので分けて持つ。 */
function parseTimetable(html) {
  const table = {};
  const marks = {};
  const parts = html.split(/data-timetable="/).slice(1);
  for (const part of parts) {
    const hm = part.match(/^(\d{1,2})"/);
    if (!hm) continue;
    const hour = Number(hm[1]);
    if (hour < 4 || hour > 25) continue;

    /* この「時」の行の範囲だけを見る（最後の塊は表の終わりで切る） */
    const stop = part.search(/<\/table>\s*<\/td>\s*<\/tr>/);
    const body = stop >= 0 ? part.slice(0, stop) : part;

    /* 入れ子の <td> があるので、内側の <td> だけを拾う。
       外側から貪欲に取ると各時の最初の1本を取りこぼす。 */
    const cells = body.match(/<td>((?:(?!<td>)[\s\S])*?)<\/td>/g) || [];
    for (const c of cells) {
      const txt = c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      const m = txt.match(/^(\D*?)(\d{1,2})$/);
      if (!m) continue;
      const mark = m[1].trim();
      const min = Number(m[2]);
      if (min > 59) continue;
      table[hour] = table[hour] || [];
      table[hour].push(min);
      if (mark) { marks[hour] = marks[hour] || {}; marks[hour][min] = mark; }
    }
    if (table[hour]) table[hour] = Array.from(new Set(table[hour])).sort((a, b) => a - b);
  }
  return { table, marks };
}

async function tobus(poleno, ud, day) {
  const u = `${TOBUS}?ln=ja&poleno=${poleno}&stopid=500&routecode=173&ud=${ud}` +
            (day ? `&dia=${day}` : '');
  const r = await fetch(u, { headers: { 'user-agent': 'livio-dashboard' } });
  if (!r.ok) return { poleno, ud, day, error: 'HTTP ' + r.status };
  const raw = await r.text();
  const lines = strip(raw);

  const dest = Array.from(new Set(lines.filter(s => s.startsWith('行先:'))));
  const revision = lines.find(s => s.startsWith('改正日')) || '';
  const dia = lines.find(s => /ダイヤで運行/.test(s)) || '';
  /* 凡例（無印/ﾆ が何行きか） */
  const legend = lines.filter(s => /：|:/.test(s) && /行|循環/.test(s) && s.length < 30 && !s.startsWith('行先'));

  const anchor = raw.indexOf('id="time_table"');
  const region = anchor >= 0 ? raw.slice(anchor) : raw;
  const { table, marks } = parseTimetable(region);

  return { poleno, ud, day, url: u, dest, dia, revision, legend, table, marks };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');
  const q = new URL(req.url, 'http://x').searchParams;

  const out = { toei: [] };
  try {
    const combos = [[1,1],[1,2],[2,1],[2,2]];
    for (const [p, ud] of combos) {
      try { out.toei.push(await tobus(p, ud, q.get('day'))); }
      catch (e) { out.toei.push({ poleno: p, ud, error: String(e.message || e) }); }
    }
  } catch (e) { out.toeiError = String(e.message || e); }

  return res.status(200).json(out);
};
