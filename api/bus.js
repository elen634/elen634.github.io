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

    /* data-timetable で分割済みなので、この塊がそのまま1時間ぶん。
       1時間が複数行に折り返される（rowspan）ため、ここで切ると取りこぼす。 */
    const body = part;

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

async function tobus(poleno, ud, day, stopid) {
  stopid = stopid || 500;
  const u = `${TOBUS}?ln=ja&poleno=${poleno}&stopid=${stopid}&routecode=173&ud=${ud}` +
            (day ? `&${day}` : '');
  const r = await fetch(u, { headers: { 'user-agent': 'livio-dashboard' } });
  if (!r.ok) return { poleno, ud, stopid, day, error: 'HTTP ' + r.status };
  const raw = await r.text();
  const lines = strip(raw);

  const dest = Array.from(new Set(lines.filter(s => s.startsWith('行先:'))));
  const revision = lines.find(s => s.startsWith('改正日')) || '';
  const dia = lines.find(s => /ダイヤで運行/.test(s)) || '';
  /* 凡例（無印/ﾆ が何行きか） */
  const legend = lines.filter(s => /：|:/.test(s) && /行|循環/.test(s) && s.length < 30 && !s.startsWith('行先'));

  const anchor = raw.indexOf('id="time_table"');
  let region = anchor >= 0 ? raw.slice(anchor) : raw;
  const tail = region.search(/ページTOP|時刻に関するご意見/);
  if (tail > 0) region = region.slice(0, tail);
  const { table, marks } = parseTimetable(region);

  return { poleno, ud, stopid, day, dest, dia, revision, legend, table, marks };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');
  const q = new URL(req.url, 'http://x').searchParams;

  const out = { note: '', rows: [] };
  const want = [
    /* 港南中学校前: のりば2 が品川駅方面（のりば1はスクショと一致＝品川埠頭方面） */
    { label: '港南中学校前 のりば2 平日', poleno: 2, ud: 2, stopid: 500, day: '' },
    { label: '港南中学校前 のりば2 土曜', poleno: 2, ud: 2, stopid: 500, day: 'dia=2' },
    { label: '港南中学校前 のりば2 休日', poleno: 2, ud: 2, stopid: 500, day: 'dia=3' },
    /* 品川駅港南口（帰宅方向）。のりば番号は総当たりで確かめる */
    { label: '品川駅港南口 のりば8 平日', poleno: 8, ud: 1, stopid: 605, day: '' },
    { label: '品川駅港南口 のりば1 平日', poleno: 1, ud: 1, stopid: 605, day: '' },
  ];
  for (const w of want) {
    try {
      const r = await tobus(w.poleno, w.ud, w.day, w.stopid);
      const n = Object.values(r.table || {}).reduce((a, b) => a + b.length, 0);
      out.rows.push({ label: w.label, dest: r.dest, dia: r.dia, revision: r.revision,
                      legend: r.legend, count: n, table: r.table, marks: r.marks });
    } catch (e) { out.rows.push({ label: w.label, error: String(e.message || e) }); }
  }

  return res.status(200).json(out);
};
