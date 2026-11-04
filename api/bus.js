/* バス時刻表の取得元をまとめて調べる口。
   ・都営バス: 港南中学校前の のりば/方向 の組み合わせを総当たりし、
     品川駅へ向かう便がどれかと、曜日別の時刻表本体を返す
   ・ちぃばす: 東京都オープンデータカタログを検索して候補を返す
   取得は読み取りのみ。 */

const TOBUS = 'https://tobus.jp/sp/blsys/stop/time';
const CKAN = 'https://catalog.data.metro.tokyo.lg.jp/api/3/action/package_search';

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .split(/\n/).map(s => s.trim()).filter(Boolean);
}

async function tobus(poleno, ud, day) {
  const u = `${TOBUS}?ln=ja&poleno=${poleno}&stopid=500&routecode=173&ud=${ud}` +
            (day ? `&dia=${day}` : '');
  const r = await fetch(u, { headers: { 'user-agent': 'livio-dashboard' } });
  if (!r.ok) return { poleno, ud, day, error: 'HTTP ' + r.status };
  const raw = await r.text();
  const lines = strip(raw);

  const dest = lines.filter(s => s.startsWith('行先:'));
  const revision = lines.find(s => s.startsWith('改正日')) || '';
  const dia = lines.find(s => /ダイヤで運行/.test(s)) || '';

  /* 時刻表本体は「4時間分だけ表示する」より後ろ */
  let i = lines.findIndex(s => /すべての時間帯を表示する|4時間分だけ表示する/.test(s));
  const body = i >= 0 ? lines.slice(i + 1) : [];

  /* 注意: テキストだけでは「18」が時なのか分なのか判別できない。
     下の table はあくまで暫定で、正しくは rawRegion の表構造を見て書き直す。 */
  const table = {};
  let hour = null;
  for (const s of body) {
    if (/^\d{1,2}$/.test(s)) {
      const n = Number(s);
      if (n >= 4 && n <= 25) { hour = n; table[hour] = table[hour] || []; continue; }
    }
    if (hour != null) {
      const m = s.match(/^[^\d]{0,3}(\d{1,2})$/);
      if (m) table[hour].push(Number(m[1]));
    }
  }

  /* 時刻表のHTMLをそのまま切り出す。tr/td の構造で時と分を確定できる。 */
  const html = raw;
  let rawRegion = '';
  const anchor = html.search(/すべての時間帯|4時間分だけ/);
  if (anchor >= 0) rawRegion = html.slice(anchor, anchor + 2600);

  return { poleno, ud, day, url: u, dest, dia, revision,
           tableTentative: table, bodySample: body.slice(0, 80), rawRegion };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');
  const q = new URL(req.url, 'http://x').searchParams;

  const out = { toei: [], chiibus: null };
  try {
    const combos = q.has('full')
      ? [[1,1],[1,2],[2,1],[2,2],[3,1],[3,2]]
      : [[1,1],[1,2]];
    for (const [p, ud] of combos) {
      try { out.toei.push(await tobus(p, ud, q.get('day'))); }
      catch (e) { out.toei.push({ poleno: p, ud, error: String(e.message || e) }); }
    }
  } catch (e) { out.toeiError = String(e.message || e); }

  try {
    const r = await fetch(CKAN + '?q=' + encodeURIComponent('ちぃばす 時刻表') + '&rows=10',
      { headers: { 'user-agent': 'livio-dashboard' } });
    const j = await r.json();
    out.chiibus = ((j.result && j.result.results) || []).map(p => ({
      id: p.name || p.id, title: p.title,
      resources: (p.resources || []).filter(x => /芝浦港南/.test(x.name || ''))
        .map(x => ({ name: x.name, url: x.url })).slice(0, 8),
    }));
  } catch (e) { out.chiibusError = String(e.message || e); }

  return res.status(200).json(out);
};
