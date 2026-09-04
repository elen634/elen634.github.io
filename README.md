# リビオタワー品川 ダッシュボード

港南3丁目の朝と帰りのための一枚ダッシュボード。
天気・品川駅まわりの運行状況・専用シャトルバスの発車案内をまとめて表示します。

ビルド不要・APIキー不要の静的サイトです。`index.html` を開くだけで動きます。

## 構成

```
index.html, assets/   ← このダッシュボード（リポジトリのルート）
progate/              ← 以前からある Progate の練習ページ
vercel.json           ← 検索避けヘッダのみ
```

ダッシュボードをルートに置いているので、GitHub Pages も Vercel も
追加設定なしでそのまま配信できます。

- GitHub Pages: https://elen634.github.io/ = ダッシュボード、`/progate/` = Progate
- Vercel: https://livio-dashboard.vercel.app = ダッシュボード

## Vercel で公開する

1. https://vercel.com/new を開く
2. `elen634/elen634.github.io` を **Import**
3. Project Name を `livio-dashboard` にして **Deploy**

**Root Directory と Output Directory は空のまま（既定のまま）にしてください。**
ダッシュボードがリポジトリのルートにあるので、変更すると逆に動きません。

## 設定

さわるのは **`assets/data.js`** だけです。

### 位置を正確にする

天気とバイクシェアの検索に使います。地図で調べた値に置き換えてください。

```js
place: { lat: 35.6236, lon: 139.7487 }
```

### 近隣バスの時刻表を入れる

`LOCAL_BUSES` の `table` に入れます。毎日同じダイヤならそのまま、
曜日で分かれるなら `weekday` / `saturday` / `holiday` に分けてください
（路線バスはたいてい後者です）。

```js
// 毎日同じ
table: { 7: [2, 18, 34, 50], 8: [4, 20, 36] }

// 曜日別
table: {
  weekday:  { 7: [2, 18, 34, 50], 8: [4, 20, 36] },
  saturday: { 7: [10, 40], 8: [10, 40] },
  holiday:  { 7: [15], 8: [15, 45] },
}
```

どのダイヤで表示中かはカード右上に出ます。`null` のあいだは公式時刻表への
リンクだけを表示します。

祝日は自動判定しません。`window.HOLIDAYS` に `'2026-10-12'` の形で足した日だけ
`holiday` ダイヤになり、それ以外の祝日は平日扱いです。

時刻表の入手先:

- 品99（港南中学校前 → 品川駅港南口）… [都バス運行情報サービス](https://tobus.jp/) / [NAVITIME](https://www.navitime.co.jp/bus/diagram/timelist?departure=00016828&arrival=00016924&line=00004136)
- ちぃばす 芝浦港南ルート（浜路橋 → 品川駅港南口）… [フジエクスプレス](https://www.fujiexpress.co.jp/chiibus/timetable/) / [東京都オープンデータカタログ（CSV）](https://catalog.data.metro.tokyo.lg.jp/dataset/t131032d0000000054)

### シャトルの曜日別ダイヤ

原本に曜日区分の記載がないため、いまは毎日同一ダイヤとして表示しています。
平日／土休日で分かれる場合は `directions[].table` を曜日ごとに分けてください。

### 自転車の判定基準

`bike` のしきい値（降水確率・雨量・風速）で変えられます。

## 動作確認

```
python3 -m http.server 8000   # → http://localhost:8000
```

`?mock=1` を付けると、通信せずにサンプル値でレイアウトを確認できます
（画面上部に警告バーが出ます）。

## 注意

- 混雑リスクは、遅延の本数・通勤ピーク・雨から出した**推定**で、実測値ではありません。
- シャトルの時刻は配布資料の書き起こしです。ダイヤ改正時は `assets/data.js` を更新してください。
- おでかけ前に公式の運行情報もあわせてご確認ください。

## 検索避けについて

居住者専用のシャトル時刻表を含むため、検索エンジンに載らないようにしています。

- `index.html` の `<meta name="robots">`
- `vercel.json` の `X-Robots-Tag` ヘッダ

どちらも消せば通常どおりインデックスされます。なお、どちらの URL も
知っている人は誰でも開ける状態です（認証はかかっていません）。
