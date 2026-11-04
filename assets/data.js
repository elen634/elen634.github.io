/* ==========================================================================
   リビオタワー品川 ダッシュボード — 設定 & 固定データ
   このファイルだけを書き換えれば、他のコードを触らずに調整できます。
   ========================================================================== */

window.DASHBOARD_CONFIG = {
  /* 住まいの位置。天気とバイクシェアの検索に使います。
     地図で正確な緯度経度を調べたら、ここを書き換えてください。 */
  place: {
    label: '東京都港区・港南3丁目',
    building: 'リビオタワー品川',
    lat: 35.6236,
    lon: 139.7487,
  },

  /* 自転車判定のしきい値 */
  bike: {
    rainProbCaution: 30,   // % これ以上で「注意」
    rainProbAvoid: 50,     // % これ以上で「非推奨」
    rainMmAvoid: 0.5,      // mm/h これ以上で「非推奨」
    windCaution: 6,        // m/s これ以上で「注意」
    windAvoid: 8,          // m/s これ以上で「非推奨」
    gustAvoid: 12,         // m/s 瞬間最大がこれ以上で「非推奨」
  },

  /* シェアサイクルの空き状況（GBFS / 公共交通オープンデータセンター）。
     LUUP は公開APIが無いため取得できません（提携サービス経由のみ）。 */
  bikeshare: {
    enabled: true,
    radiusMeters: 900,
    maxPorts: 4,
    providers: [
      { id: 'docomo', label: 'ドコモ・バイクシェア', system: 'docomo-cycle-tokyo' },
      { id: 'hello',  label: 'HELLO CYCLING',      system: 'hellocycling' },
    ],
    base: 'https://api-public.odpt.org/api/v4/gbfs/',
    /* 徒歩の所要時間。運河や橋を迂回する区間があるため直線距離では正しく出ません。
       経路検索に成功したときだけ「徒歩◯分」を表示し、失敗したら直線距離のみ出します。 */
    walk: {
      enabled: true,
      url: 'https://valhalla1.openstreetmap.de/sources_to_targets',
      speedKmh: 4.5,
    },
    /* LUUP はアプリで確認するためのリンクだけ置いています。 */
    luupUrl: 'https://luup.sc/app/',
  },

  /* 品川駅まわりの運行情報。
     公共交通オープンデータセンター(ODPT)の odpt:TrainInformation を使います。
     api-public はキー不要ですが、事業者によっては提供されない場合があります。
     実測（2026-11）では api-public がデータを返すのは東京都交通局のみで、
     JR東日本・京急・りんかい線・モノレールは 0 件でした。これらを取得するには
     odpt.org の無料開発者登録で得た consumerKey が必要です。

     ※ このリポジトリは公開なので、キーをここに書かないでください。
       ダッシュボードを ?odptkey=取得したキー 付きで一度開けば、
       ブラウザの localStorage に保存されます。 */
  rail: {
    enabled: true,
    publicBase: 'https://api-public.odpt.org/api/v4/odpt:TrainInformation',
    keyedBase: 'https://api.odpt.org/api/v4/odpt:TrainInformation',
    consumerKey: '',   // ← 空のままにする（上の注意を参照）
    groups: [
      {
        label: '品川乗り入れJR線',
        operator: 'odpt.Operator:JR-East',
        /* odpt:railway の末尾で絞り込み。空なら事業者の全路線 */
        railways: ['Yamanote', 'KeihinTohokuNegishi', 'Tokaido', 'Yokosuka', 'UenoTokyo', 'Joban', 'SobuRapid'],
        url: 'https://traininfo.jreast.co.jp/train_info/kanto.aspx',
      },
      {
        label: '京急（品川関連）',
        operator: 'odpt.Operator:Keikyu',
        railways: [],
        url: 'https://unkou.keikyu.co.jp/',
      },
      {
        label: '都営浅草線（京急直通）',
        operator: 'odpt.Operator:Toei',
        railways: ['Asakusa'],
        url: 'https://www.kotsu.metro.tokyo.jp/subway/schedule/',
      },
      {
        label: 'りんかい線・モノレール',
        operator: 'odpt.Operator:TWR',
        railways: [],
        extraOperators: ['odpt.Operator:TokyoMonorail'],
        url: 'https://www.twr.co.jp/unkou/',
      },
    ],
  },
};

/* 祝日（YYYY-MM-DD）。ここに入れた日は holiday ダイヤで表示します。
   空のあいだ、祝日は平日ダイヤ扱いになります。 */
window.HOLIDAYS = [
  // '2026-10-12', // スポーツの日
];

/* ==========================================================================
   専用シャトルバス時刻表
   出典: 管理規約 別添2「リビオタワー品川発 / 品川駅港南口発」時刻表
   ※ 原本に曜日区分の記載がないため、毎日同一ダイヤとして表示しています。
     平日／土休日でダイヤが分かれる場合は directions[].table を分けてください。
   ========================================================================== */

window.SHUTTLE = {
  name: 'リビオタワー品川・専用シャトルバス',
  badge: '居住者専用',
  accent: '#8a9a2b',
  source: '管理規約 別添2 時刻表',
  serviceNote: '毎日同一ダイヤとして表示（原本に曜日区分の記載なし）',
  directions: [
    {
      id: 'out',
      from: 'リビオタワー品川',
      to: '品川駅港南口',
      table: {
        7:  [0, 15, 35, 50],
        8:  [10, 25, 45],
        9:  [0, 20, 35],
        10: [55],
        11: [15, 35, 55],
        12: [15],
        13: [15, 35, 55],
        14: [35, 55],
        15: [15, 35, 55],
        16: [15],
        17: [15, 35, 55],
        18: [15, 35, 55],
        19: [15, 35, 55],
        20: [55],
        21: [15, 35],
      },
    },
    {
      id: 'in',
      from: '品川駅港南口',
      to: 'リビオタワー品川',
      table: {
        11: [0, 20, 40],
        12: [0, 20],
        13: [20, 40],
        14: [0, 40],
        15: [20, 40],
        16: [0, 20],
        17: [20, 40],
        18: [0, 20, 40],
        19: [0, 20, 40],
        20: [0],
        21: [0, 20, 40],
      },
    },
  ],
};

/* ==========================================================================
   近隣の路線バス

   table は次のどちらの形でも書けます。

     { 7: [2, 18], 8: [4, 20] }                        … 毎日同じダイヤ
     { weekday: {...}, saturday: {...}, holiday: {...} } … 曜日別
                                                          （バスは基本こちら）

   null のあいだは、公式時刻表へのリンクだけを表示します。
   ========================================================================== */

window.LOCAL_BUSES = [
  {
    name: '都営バス・品99',
    badge: '都営',
    accent: '#2f7d5a',
    from: '港南中学校前',
    to: '品川駅港南口',
    /* 品99 は 品川駅港南口 ⇄ 品川埠頭。下は 港南中学校前 → 品川駅港南口 の時刻表。
       公式は都バス運行情報サービス（tobus.jp）でも確認できます。 */
    url: 'https://www.navitime.co.jp/bus/diagram/timelist?departure=00016828&arrival=00016924&line=00004136',
    table: null,
  },
  {
    name: '港区コミュニティバス・ちぃばす',
    badge: '芝浦港南ルート',
    accent: '#2b6ea3',
    from: '浜路橋',
    to: '品川駅港南口',
    /* 芝浦港南ルートは 田町駅東口 ⇄ 品川駅港南口。運行はフジエクスプレス。
       時刻表の CSV が東京都オープンデータカタログにあります:
       https://catalog.data.metro.tokyo.lg.jp/dataset/t131032d0000000054 */
    url: 'https://www.fujiexpress.co.jp/chiibus/timetable/',
    table: null,
  },
];
