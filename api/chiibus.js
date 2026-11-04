/* ちぃばす時刻表の取り出し口。
   東京都オープンデータカタログ(CKAN)はブラウザから直接叩くと CORS で止まるため、
   Vercel のサーバー側で取得して返す。?raw=1 を付けると中身の先頭を返すので、
   CSV の形式を確認するのに使える。 */

const DATASET = 't131032d0000000054';           // 港区コミュニティバス「ちぃばす」時刻表
const CKAN = 'https://catalog.data.metro.tokyo.lg.jp/api/3/action/package_show?id=' + DATASET;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  try {
    const pkg = await fetch(CKAN, { headers: { 'user-agent': 'livio-dashboard' } });
    if (!pkg.ok) throw new Error('CKAN ' + pkg.status);
    const json = await pkg.json();
    const resources = (json.result && json.result.resources) || [];

    /* 芝浦港南ルートの、品川駅港南口ゆきだけに絞る */
    const wanted = resources
      .filter(r => /芝浦港南/.test(r.name || ''))
      .map(r => ({ name: r.name, url: r.url, format: r.format }));

    const url = new URL(req.url, 'http://x');
    if (!url.searchParams.has('raw')) {
      return res.status(200).json({ dataset: DATASET, total: resources.length, shibauraKonan: wanted });
    }

    /* 形式確認用: 最初の1件の中身を先頭だけ返す */
    const pick = wanted.find(r => /品川/.test(r.name)) || wanted[0];
    if (!pick) return res.status(200).json({ error: '芝浦港南ルートの資源が見つからない', resources: resources.map(r => r.name) });

    const csv = await fetch(pick.url, { headers: { 'user-agent': 'livio-dashboard' } });
    const buf = Buffer.from(await csv.arrayBuffer());
    /* 都のCSVは Shift_JIS のことがある */
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { text = new TextDecoder('shift_jis').decode(buf); }

    return res.status(200).json({
      picked: pick.name, url: pick.url, bytes: buf.length,
      head: text.split(/\r?\n/).slice(0, 25),
    });
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message || e) });
  }
};
