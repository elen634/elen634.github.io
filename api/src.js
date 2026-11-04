/* 時刻表の取得元を確認するための読み取り口。
   ブラウザからは CORS で止まる先でも、サーバー側なら取得できる。
   取得先は下の許可リストに限定している（任意のURLを踏ませないため）。 */

const ALLOW = [
  'tobus.jp',
  'www.fujiexpress.co.jp',
  'fujiexpress.co.jp',
  'catalog.data.metro.tokyo.lg.jp',
  'www.city.minato.tokyo.jp',
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const q = new URL(req.url, 'http://x').searchParams;
  const target = q.get('url');
  if (!target) return res.status(400).json({ error: 'url がありません', allow: ALLOW });

  let u;
  try { u = new URL(target); } catch (e) { return res.status(400).json({ error: 'URLとして読めません' }); }
  if (u.protocol !== 'https:') return res.status(400).json({ error: 'httpsのみ' });
  if (!ALLOW.includes(u.hostname)) return res.status(403).json({ error: '許可していない取得先', host: u.hostname, allow: ALLOW });

  try {
    const r = await fetch(u.toString(), { headers: { 'user-agent': 'livio-dashboard' } });
    const buf = Buffer.from(await r.arrayBuffer());
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { text = new TextDecoder('shift_jis').decode(buf); }

    const lines = Number(q.get('lines') || 60);
    /* タグを落として読みやすくする（中身の確認が目的のため） */
    const plain = q.has('html') ? text
      : text.replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '\n')
            .split(/\n/).map(s => s.trim()).filter(Boolean).join('\n');

    return res.status(200).json({
      status: r.status,
      type: r.headers.get('content-type'),
      bytes: buf.length,
      head: plain.split(/\r?\n/).slice(0, lines),
    });
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message || e) });
  }
};
