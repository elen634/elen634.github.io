/* 住所から緯度経度を引く。国土地理院の住所検索を使う（キー不要）。
   ブラウザから直接だと CORS で止まるため、サーバー側で取得して返す。 */

const GSI = 'https://msearch.gsi.go.jp/address-search/AddressSearch';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const q = new URL(req.url, 'http://x').searchParams.get('q');
  if (!q) return res.status(400).json({ error: '住所(q)がありません' });

  try {
    const r = await fetch(GSI + '?q=' + encodeURIComponent(q),
      { headers: { 'user-agent': 'livio-dashboard' } });
    if (!r.ok) throw new Error('GSI ' + r.status);
    const list = await r.json();
    if (!Array.isArray(list) || !list.length) {
      return res.status(200).json({ query: q, results: [] });
    }
    const results = list.slice(0, 5).map(f => ({
      title: f.properties && f.properties.title,
      lon: f.geometry.coordinates[0],   // GSI は [経度, 緯度] の順
      lat: f.geometry.coordinates[1],
    }));
    return res.status(200).json({ query: q, results });
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message || e) });
  }
};
