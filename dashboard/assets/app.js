/* リビオタワー品川 ダッシュボード
   静的サイト。ビルド不要・APIキー不要。取得できなかったデータは
   その部分だけ「取得できず」になり、他の表示は生きたままになります。 */
(function () {
  'use strict';

  var CFG = window.DASHBOARD_CONFIG;
  var MOCK = new URLSearchParams(location.search).has('mock');
  var TZ = 'Asia/Tokyo';
  var REFRESH_MS = 5 * 60 * 1000;

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  var pad = function (n) { return String(n).padStart(2, '0'); };

  /* ---------- 東京時刻 ---------- */
  var DOW = ['日', '月', '火', '水', '木', '金', '土'];

  function tokyoNow() {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    }).formatToParts(new Date()).reduce(function (a, p) { a[p.type] = p.value; return a; }, {});
    var hh = parseInt(parts.hour, 10) % 24;   // 24:00 表記対策
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    return {
      y: +parts.year, mo: +parts.month, d: +parts.day,
      hh: hh, mm: +parts.minute, ss: +parts.second,
      dow: wd < 0 ? 0 : wd,
      minutes: hh * 60 + (+parts.minute),
      iso: parts.year + '-' + parts.month + '-' + parts.day,
    };
  }

  /* ---------- 時間帯モード ---------- */
  function modeOf(t) {
    var weekend = t.dow === 0 || t.dow === 6;
    if (t.hh >= 5 && t.hh < 10) return weekend ? '朝' : '朝の移動';
    if (t.hh >= 10 && t.hh < 16) return '日中';
    if (t.hh >= 16 && t.hh < 21) return weekend ? '夕方' : '帰宅';
    return '夜';
  }

  /* ---------- 天気アイコン ---------- */
  function svg(paths, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>' + (extra || '');
  }
  var ART = {
    sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2M12 19.6v2M2.4 12h2M19.6 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>'),
    partly: svg('<circle cx="8.5" cy="8.5" r="3.1"/><path d="M8.5 2.6v1.6M2.6 8.5h1.6M4.4 4.4l1.1 1.1M12.6 4.4l-1.1 1.1"/><path d="M17 20H8.6A3.6 3.6 0 018.6 12.8a5 5 0 019.5 1.5A2.9 2.9 0 0117 20z"/>'),
    cloud: svg('<path d="M17.2 19H7.8a4 4 0 010-8 5.5 5.5 0 0110.5 1.6A3.2 3.2 0 0117.2 19z"/>'),
    fog: svg('<path d="M17.2 14.5H7.8a4 4 0 010-8 5.5 5.5 0 0110.5 1.6 3.2 3.2 0 01-1.1 6.4z"/><path d="M4 18h16M6.5 21.2h11"/>'),
    rain: svg('<path d="M12 3v1.6"/><path d="M2.8 13a9.2 9.2 0 0118.4 0z"/><path d="M12 13v6.2a2.1 2.1 0 004.2 0"/>'),
    heavy: svg('<path d="M12 2.6v1.6"/><path d="M2.6 12.6a9.4 9.4 0 0118.8 0z"/><path d="M12 12.6v6.6a2.2 2.2 0 004.4 0"/><path d="M6.4 16.6l-1 2.6M9.2 17.4l-.8 2"/>'),
    snow: svg('<path d="M17.2 13.5H7.8a4 4 0 010-8 5.5 5.5 0 0110.5 1.6 3.2 3.2 0 01-1.1 6.4z"/><path d="M8.5 17v.01M12 18.6v.01M15.5 17v.01M10.2 20.8v.01M13.8 20.8v.01"/>'),
    storm: svg('<path d="M17.2 13.4H7.8a4 4 0 010-8 5.5 5.5 0 0110.5 1.6 3.2 3.2 0 01-1.1 6.4z"/><path d="M12.8 15.4L10 19.2h3l-1.4 3.2"/>'),
  };

  function wxOf(code, isNight) {
    code = Number(code);
    if (code === 0) return { art: ART.sun, label: isNight ? '快晴' : '快晴', tone: 'clear' };
    if (code === 1) return { art: isNight ? ART.sun : ART.sun, label: '晴れ', tone: 'clear' };
    if (code === 2) return { art: ART.partly, label: '晴れ時々くもり', tone: 'clear' };
    if (code === 3) return { art: ART.cloud, label: 'くもり', tone: 'cloud' };
    if (code === 45 || code === 48) return { art: ART.fog, label: '霧', tone: 'cloud' };
    if (code >= 51 && code <= 57) return { art: ART.rain, label: '霧雨', tone: 'rain' };
    if (code === 61) return { art: ART.rain, label: '弱い雨', tone: 'rain' };
    if (code === 63) return { art: ART.rain, label: '雨', tone: 'rain' };
    if (code === 65) return { art: ART.heavy, label: '強い雨', tone: 'rain' };
    if (code === 66 || code === 67) return { art: ART.heavy, label: '着氷性の雨', tone: 'rain' };
    if (code >= 71 && code <= 77) return { art: ART.snow, label: '雪', tone: 'snow' };
    if (code === 80 || code === 81) return { art: ART.rain, label: 'にわか雨', tone: 'rain' };
    if (code === 82) return { art: ART.heavy, label: '激しいにわか雨', tone: 'rain' };
    if (code === 85 || code === 86) return { art: ART.snow, label: 'にわか雪', tone: 'snow' };
    if (code >= 95) return { art: ART.storm, label: '雷雨', tone: 'rain' };
    return { art: ART.cloud, label: '—', tone: 'cloud' };
  }

  var GLYPH = {
    rain: svg('<path d="M12 3v1.4"/><path d="M3.4 12.4a8.6 8.6 0 0117.2 0z"/><path d="M12 12.4v6a2 2 0 004 0"/>'),
    wind: svg('<path d="M3 8.5h11a2.8 2.8 0 10-2.8-2.8"/><path d="M3 13h15a2.8 2.8 0 11-2.8 2.8"/><path d="M3 17.6h7"/>'),
  };

  var DIR16 = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
               '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  function windDir(deg) {
    if (deg == null || isNaN(deg)) return '';
    return DIR16[Math.round(deg / 22.5) % 16];
  }

  /* ---------- 状態 ---------- */
  var state = {
    weather: null,
    rail: null,
    railOk: false,
    ports: null,
    dir: null,        // シャトルの表示方向（手動で切り替えたら固定）
    dirLocked: false,
  };

  /* ================= 時計 ================= */
  function paintClock() {
    var t = tokyoNow();
    $('clock').textContent = pad(t.hh) + ':' + pad(t.mm);
    $('date').textContent = t.mo + '/' + t.d + '(' + DOW[t.dow] + ')';
    $('place').textContent = CFG.place.label;
    $('mode-pill-text').textContent = modeOf(t);
    return t;
  }

  /* ================= 天気 ================= */
  function weatherUrl() {
    var p = new URLSearchParams({
      latitude: CFG.place.lat,
      longitude: CFG.place.lon,
      current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day',
      hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index',
      timezone: TZ,
      wind_speed_unit: 'ms',
      forecast_days: '3',
    });
    return 'https://api.open-meteo.com/v1/forecast?' + p;
  }

  function fetchWeather() {
    if (MOCK) return Promise.resolve(mockWeather());
    return fetch(weatherUrl(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('weather ' + r.status); return r.json(); });
  }

  /* hourly.time は "YYYY-MM-DDTHH:00"（Asia/Tokyo）。現在時に対応する添字を返す */
  function hourIndex(times, t) {
    var key = t.iso + 'T' + pad(t.hh) + ':00';
    var i = times.indexOf(key);
    return i < 0 ? 0 : i;
  }

  function paintWeather(w, t) {
    var c = w.current, h = w.hourly;
    var i = hourIndex(h.time, t);
    var night = c.is_day === 0;
    var wx = wxOf(c.weather_code, night);

    $('wx-icon').className = 'wx-icon t-' + wx.tone;
    $('wx-icon').innerHTML = wx.art;
    $('wx-temp').textContent = c.temperature_2m.toFixed(1);
    $('wx-desc').textContent = wx.label + ' · 体感 ' + c.apparent_temperature.toFixed(1) + '°';

    var uv = h.uv_index && h.uv_index[i];
    var uvBox = $('wx-uv');
    if (uv != null && uv >= 0.5 && !night) {
      uvBox.hidden = false;
      uvBox.textContent = 'UV ' + uv.toFixed(1) + (uv >= 8 ? ' — 非常に強い' : uv >= 6 ? ' — 強い' : uv >= 3 ? ' — 中程度' : ' — 弱い');
    } else { uvBox.hidden = true; }

    var pop = h.precipitation_probability[i];
    var popBox = $('wx-pop').parentNode;
    $('wx-pop').textContent = pop == null ? '--' : pop;
    popBox.className = 'metric-value' + (pop >= 70 ? ' is-high' : pop >= 40 ? ' is-mid' : '');
    $('wx-mm').textContent = '雨量 ' + (c.precipitation != null ? c.precipitation.toFixed(1) : '0.0') + ' mm/h';

    $('wx-wind').textContent = c.wind_speed_10m.toFixed(1);
    var windBox = $('wx-wind').parentNode;
    windBox.className = 'metric-value' + (c.wind_speed_10m >= 10 ? ' is-high' : c.wind_speed_10m >= 7 ? ' is-mid' : '');
    $('wx-gust').textContent = [windDir(c.wind_direction_10m), '瞬間最大 ' + c.wind_gusts_10m.toFixed(1) + ' m/s']
      .filter(Boolean).join(' · ');

    /* 2時間ごと */
    $('hourly-place').textContent = CFG.place.label.split('・').pop();
    var box = $('hourly');
    box.innerHTML = '';
    for (var k = 0; k < 8; k++) {
      var j = i + k * 2;
      if (j >= h.time.length) break;
      var hr = +h.time[j].slice(11, 13);
      var p = h.precipitation_probability[j];
      var mm = h.precipitation[j];
      var isNightSlot = hr < 5 || hr >= 18;
      var a = wxOf(h.weather_code[j], isNightSlot);

      var cell = el('div', 'hr' + (k === 0 ? ' is-now' : ''));
      cell.appendChild(el('div', 'hr-time', hr + '時'));
      var ic = el('div', 'hr-icon t-' + a.tone);
      ic.innerHTML = a.art;
      cell.appendChild(ic);
      cell.appendChild(el('div', 'hr-pop' + (p >= 70 ? ' is-high' : p >= 40 ? ' is-mid' : ''), (p == null ? '--' : p) + '%'));
      cell.appendChild(el('div', 'hr-mm' + (mm >= 3 ? ' is-high' : ''), (mm == null ? 0 : mm).toFixed(1)));
      box.appendChild(cell);
    }
  }

  /* ================= 自転車 ================= */
  /* 指定した時間帯（東京時刻の時 from..to）を評価する */
  function windowStats(w, t, fromH, toH) {
    var h = w.hourly, i = hourIndex(h.time, t);
    var pop = 0, mm = 0, wind = 0, gust = 0, n = 0;
    for (var j = i; j < h.time.length; j++) {
      if (h.time[j].slice(0, 10) !== t.iso) break;   // 当日ぶんだけ見る
      var hr = +h.time[j].slice(11, 13);
      if (hr < fromH || hr > toH) continue;
      pop = Math.max(pop, h.precipitation_probability[j] || 0);
      mm = Math.max(mm, h.precipitation[j] || 0);
      wind = Math.max(wind, h.wind_speed_10m[j] || 0);
      gust = Math.max(gust, (h.wind_gusts_10m && h.wind_gusts_10m[j]) || 0);
      n++;
    }
    return n ? { pop: pop, mm: mm, wind: wind, gust: gust, ok: true } : { ok: false };
  }

  function judge(s) {
    var b = CFG.bike;
    if (!s.ok) return { level: 0, word: '—', why: '' };
    if (s.pop >= b.rainProbAvoid || s.mm >= b.rainMmAvoid || s.wind >= b.windAvoid || s.gust >= b.gustAvoid) {
      var why = (s.pop >= b.rainProbAvoid || s.mm >= b.rainMmAvoid) ? '雨' : '';
      if (s.wind >= b.windAvoid || s.gust >= b.gustAvoid) why = why ? '雨と風' : '風';
      return { level: 2, word: '非推奨', why: '強い' + why + 'のため公共交通機関がおすすめです' };
    }
    if (s.pop >= b.rainProbCaution || s.wind >= b.windCaution) {
      return { level: 1, word: '注意', why: '雨具か、風に注意して。降水確率 ' + Math.round(s.pop) + '% / 風 ' + s.wind.toFixed(1) + ' m/s' };
    }
    return { level: 0, word: '推奨', why: '降水確率 ' + Math.round(s.pop) + '% / 風 ' + s.wind.toFixed(1) + ' m/s。走りやすい天気です' };
  }

  function paintBike(w, t) {
    var goFrom = Math.max(t.hh, 5), goTo = Math.min(goFrom + 2, 23);
    var back = windowStats(w, t, 17, 20);
    var go = windowStats(w, t, goFrom, goTo);

    var jGo = judge(go), jBack = judge(back);
    var worst = jGo.level >= jBack.level ? jGo : jBack;
    var card = $('bike-card');

    var unknown = worst.word === '—';
    card.className = 'card bike-card ' + (unknown ? '' : worst.level === 2 ? 'is-avoid' : worst.level === 1 ? 'is-caution' : 'is-ok');
    $('bike-when').textContent = '今日の自転車';
    $('bike-mark').textContent = unknown ? '' : worst.level === 2 ? '✕' : worst.level === 1 ? '△' : '○';
    $('bike-word').textContent = worst.word;
    $('bike-reason').textContent = worst.why;

    var legs = $('bike-legs');
    legs.innerHTML = '';
    [['行き', jGo], ['帰り', jBack]].forEach(function (pair) {
      if (!pair[1].word || pair[1].word === '—') return;
      var mark = pair[1].level === 2 ? '✕' : pair[1].level === 1 ? '△' : '○';
      legs.appendChild(el('span', 'leg', pair[0] + ' ' + mark));
    });
  }

  /* ================= 運行情報 ================= */
  function fetchRail() {
    if (!CFG.rail.enabled) return Promise.resolve(null);
    if (MOCK) return Promise.resolve(mockRail());
    return fetch(CFG.rail.url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('rail ' + r.status); return r.json(); });
  }

  /* delay.json は「いま遅れている路線」だけの配列。
     載っていない = 平常運転、として扱う。 */
  function railGroups(list) {
    return CFG.rail.groups.map(function (g) {
      var hit = (list || []).filter(function (item) {
        var name = String(item.name || '');
        var co = String(item.company || '');
        var nameHit = g.match.some(function (m) { return name.indexOf(m) >= 0; });
        if (!nameHit) return false;
        if (g.company) return g.company.some(function (c) { return co.indexOf(c) >= 0; }) || co === '';
        return true;
      });
      return { label: g.label, url: g.url, hits: hit };
    });
  }

  function paintRail(list, t, w) {
    var groups = railGroups(list);
    var box = $('station-lines');
    box.innerHTML = '';

    var disrupted = 0;
    groups.forEach(function (g) {
      var bad = g.hits.length > 0;
      if (bad) disrupted += g.hits.length;

      var row = el('div', 'line-row');
      row.appendChild(el('i', 'dot ' + (bad ? 'dot-warn' : 'dot-ok')));
      var main = el('div', 'line-main');
      var head = el('div', 'line-head');
      head.appendChild(el('div', 'line-name', g.label));
      head.appendChild(el('div', 'line-state ' + (bad ? 'is-warn' : 'is-ok'), bad ? '遅延・乱れ' : '平常運転'));
      main.appendChild(head);
      if (bad) {
        var d = el('p', 'line-detail');
        d.appendChild(document.createTextNode(g.hits.map(function (x) { return x.name; }).join(' / ') + ' に遅れの情報。'));
        if (g.url) {
          var a = el('a', null, '公式の運行情報 ›');
          a.href = g.url; a.target = '_blank'; a.rel = 'noopener';
          d.appendChild(document.createTextNode(' '));
          d.appendChild(a);
        }
        main.appendChild(d);
      }
      row.appendChild(main);
      box.appendChild(row);
    });

    /* 混雑リスク（推定）: 乱れ + 通勤ピーク + 強い雨 */
    var peak = (t.dow >= 1 && t.dow <= 5) && ((t.hh >= 7 && t.hh < 10) || (t.hh >= 17 && t.hh < 21));
    var rain = w && w.current ? w.current.precipitation >= 2 : false;
    var score = disrupted * 2 + (peak ? 1 : 0) + (rain ? 1 : 0);
    var level = score >= 4 ? 2 : score >= 2 ? 1 : 0;

    var row2 = el('div', 'line-row');
    row2.appendChild(el('i', 'dot ' + (level === 2 ? 'dot-bad' : level === 1 ? 'dot-warn' : 'dot-ok')));
    var m2 = el('div', 'line-main');
    var h2 = el('div', 'line-head');
    h2.appendChild(el('div', 'line-name', '駅混雑（推定）'));
    h2.appendChild(el('div', 'line-state ' + (level === 2 ? 'is-bad' : level === 1 ? 'is-warn' : 'is-ok'),
      level === 2 ? '混雑リスク 高' : level === 1 ? '混雑リスク 中' : '通常範囲'));
    m2.appendChild(h2);
    row2.appendChild(m2);
    box.appendChild(row2);

    $('station-dot').className = 'dot ' + (level === 2 ? 'dot-bad' : level === 1 ? 'dot-warn' : 'dot-ok');
    var st = $('station-state');
    st.textContent = level === 2 ? '混雑リスク 高' : level === 1 ? '混雑リスク 中' : '通常範囲';
    st.className = level === 2 ? 'is-bad' : level === 1 ? 'is-warn' : 'is-ok';
    $('station-note').textContent = disrupted
      ? '品川駅関連路線で遅延・乱れを検知'
      : '品川駅関連路線に遅延の情報はありません';

    paintAlert(level, disrupted, rain, peak);
  }

  function paintRailUnavailable() {
    var box = $('station-lines');
    box.innerHTML = '';
    var row = el('div', 'line-row');
    row.appendChild(el('i', 'dot'));
    var m = el('div', 'line-main');
    var h = el('div', 'line-head');
    h.appendChild(el('div', 'line-name', '運行情報'));
    h.appendChild(el('div', 'line-state is-ok', '取得できず'));
    m.appendChild(h);
    var d = el('p', 'line-detail');
    CFG.rail.groups.forEach(function (g, k) {
      if (!g.url) return;
      if (k) d.appendChild(document.createTextNode(' / '));
      var a = el('a', null, g.label + ' ›');
      a.href = g.url; a.target = '_blank'; a.rel = 'noopener';
      d.appendChild(a);
    });
    m.appendChild(d);
    row.appendChild(m);
    box.appendChild(row);
    $('station-dot').className = 'dot';
    $('station-state').textContent = '—';
    $('station-state').className = '';
    $('station-note').textContent = '公式サイトでご確認ください';
    $('alert-slot').innerHTML = '';
  }

  function paintAlert(level, disrupted, rain, peak) {
    var slot = $('alert-slot');
    slot.innerHTML = '';
    if (level < 2) return;

    var a = el('div', 'alert');
    a.appendChild(el('div', 'alert-mark', '!'));

    var main = el('div', 'alert-main');
    main.appendChild(el('div', 'alert-kicker', 'いま、移動ルートの見直しを'));
    main.appendChild(el('div', 'alert-title', '品川駅 混雑リスク 高（推定）'));
    var tags = el('div', 'alert-tags');
    if (disrupted) tags.appendChild(el('span', 'alert-tag', '品川駅関連路線で ' + disrupted + ' 路線に遅れ'));
    if (peak) tags.appendChild(el('span', 'alert-tag', '通勤ピーク時間帯'));
    if (rain) tags.appendChild(el('span', 'alert-tag', '強い雨'));
    main.appendChild(tags);
    a.appendChild(main);

    var aside = el('div', 'alert-aside');
    aside.appendChild(el('div', 'label', '品川を避ける場合'));
    aside.appendChild(el('b', null, '高輪ゲートウェイ / 田町での乗降を検討'));
    a.appendChild(aside);

    slot.appendChild(a);
  }

  /* ================= バス ================= */
  /* table は「毎日同一」か「曜日別」のどちらか。今日ぶんを取り出す。
     祝日は window.HOLIDAYS に載っている日だけ holiday 扱い。 */
  var DAYKEYS = ['weekday', 'saturday', 'holiday'];

  function isDayTyped(table) {
    return !!table && DAYKEYS.some(function (k) { return table[k]; });
  }

  function tableFor(table, t) {
    if (!isDayTyped(table)) return table;
    var holiday = t.dow === 0 || (window.HOLIDAYS || []).indexOf(t.iso) >= 0;
    var order = holiday ? ['holiday', 'saturday', 'weekday']
      : t.dow === 6 ? ['saturday', 'holiday', 'weekday']
      : ['weekday'];
    for (var i = 0; i < order.length; i++) {
      if (table[order[i]]) return table[order[i]];
    }
    return null;
  }

  function dayLabel(table, t) {
    if (!isDayTyped(table)) return '';
    var holiday = t.dow === 0 || (window.HOLIDAYS || []).indexOf(t.iso) >= 0;
    return holiday ? '休日ダイヤ' : t.dow === 6 ? '土曜ダイヤ' : '平日ダイヤ';
  }

  /* table: { 時: [分, …] } から、いまより後の発車を count 件返す（翌日へ繰り越し） */
  function nextDepartures(table, t, count) {
    var slots = [];
    Object.keys(table).forEach(function (h) {
      table[h].forEach(function (m) { slots.push(+h * 60 + m); });
    });
    slots.sort(function (a, b) { return a - b; });
    if (!slots.length) return [];

    var out = [];
    for (var i = 0; i < slots.length && out.length < count; i++) {
      if (slots[i] >= t.minutes) out.push({ at: slots[i], wait: slots[i] - t.minutes, tomorrow: false });
    }
    for (var j = 0; j < slots.length && out.length < count; j++) {
      out.push({ at: slots[j], wait: slots[j] + 1440 - t.minutes, tomorrow: true });
    }
    return out;
  }

  function hhmm(minutesOfDay) {
    var m = ((minutesOfDay % 1440) + 1440) % 1440;
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }

  function routeCard(opts, t) {
    var card = el('article', 'route');
    if (opts.accent) card.style.setProperty('--accent', opts.accent);

    var today = tableFor(opts.table, t);
    var dayNote = dayLabel(opts.table, t);

    var head = el('div', 'route-head');
    head.appendChild(el('div', 'route-badge', opts.name));
    if (opts.badge || dayNote) {
      var b = el('div', 'route-badge');
      b.appendChild(el('i', 'dot dot-ok'));
      b.appendChild(document.createTextNode([opts.badge, dayNote].filter(Boolean).join(' · ')));
      head.appendChild(b);
    }
    card.appendChild(head);

    if (opts.dirs) card.appendChild(opts.dirs);
    card.appendChild(el('div', 'route-title', opts.from + ' → ' + opts.to));

    if (!today) {
      var empty = el('div', 'route-empty');
      empty.appendChild(el('b', null, '時刻表 未登録'));
      empty.appendChild(document.createTextNode('assets/data.js の table に時刻を入れると、ここに発車案内が出ます。'));
      card.appendChild(empty);
      var f0 = el('div', 'route-foot');
      f0.appendChild(el('span', null, ''));
      if (opts.url) {
        var a0 = el('a', 'route-link', '公式時刻表 ›');
        a0.href = opts.url; a0.target = '_blank'; a0.rel = 'noopener';
        f0.appendChild(a0);
      }
      card.appendChild(f0);
      return card;
    }

    var deps = nextDepartures(today, t, 3);
    var body = el('div', 'route-body');

    if (!deps.length) {
      card.appendChild(el('div', 'route-empty', '運行データがありません'));
      return card;
    }

    var first = deps[0];
    var cd = el('div', 'countdown' + (!first.tomorrow && first.wait <= 3 ? ' is-soon' : ''));
    if (first.tomorrow) {
      cd.appendChild(el('b', null, '—'));
      cd.appendChild(el('span', null, '本日の運行は終了'));
    } else {
      cd.appendChild(el('b', null, String(first.wait)));
      cd.appendChild(el('span', null, '分後'));
    }
    body.appendChild(cd);

    var when = el('div', 'route-when');
    when.appendChild(el('div', 'label', first.tomorrow ? '翌日の始発' : '発車予定'));
    when.appendChild(el('b', null, hhmm(first.at)));
    body.appendChild(when);
    card.appendChild(body);

    var foot = el('div', 'route-foot');
    var nexts = el('span');
    deps.slice(1).forEach(function (d, k) {
      if (k) nexts.appendChild(document.createTextNode('　'));
      nexts.appendChild(document.createTextNode(k === 0 ? '次 ' : 'その次 '));
      var strong = el('b', null, d.tomorrow ? hhmm(d.at) : d.wait + '分後');
      nexts.appendChild(strong);
    });
    foot.appendChild(nexts);

    var link = el('button', 'route-link', '時刻表 ›');
    link.type = 'button';
    link.addEventListener('click', function () { openTimetable(opts.modal || opts, t); });
    foot.appendChild(link);
    card.appendChild(foot);

    return card;
  }

  function paintRoutes(t) {
    var box = $('routes');
    box.innerHTML = '';

    /* シャトル：時間帯から向きを自動選択（手動切替後は固定） */
    var S = window.SHUTTLE;
    if (!state.dirLocked) {
      var evening = t.hh >= 15;
      state.dir = evening ? 'in' : 'out';
    }
    var dir = S.directions.filter(function (d) { return d.id === state.dir; })[0] || S.directions[0];

    var dirs = el('div', 'dirs');
    S.directions.forEach(function (d) {
      var btn = el('button', null, d.from === S.directions[0].from ? '自宅発' : '品川駅発');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(d.id === dir.id));
      btn.addEventListener('click', function () {
        state.dir = d.id; state.dirLocked = true; paintRoutes(tokyoNow());
      });
      dirs.appendChild(btn);
    });

    box.appendChild(routeCard({
      name: S.name, badge: S.badge, accent: S.accent,
      from: dir.from, to: dir.to, table: dir.table, dirs: dirs,
      modal: { title: S.name, note: S.serviceNote + ' / 出典: ' + S.source, directions: S.directions },
    }, t));

    (window.LOCAL_BUSES || []).forEach(function (r) {
      box.appendChild(routeCard({
        name: r.name, badge: r.badge, accent: r.accent,
        from: r.from, to: r.to, table: r.table, url: r.url,
        modal: { title: r.name, directions: [{ from: r.from, to: r.to, table: r.table }] },
      }, t));
    });
  }

  /* ---------- 時刻表モーダル ---------- */
  function openTimetable(m, t) {
    $('modal-title').textContent = m.title || '時刻表';
    var body = $('modal-body');
    body.innerHTML = '';

    (m.directions || []).forEach(function (d) {
      var src = tableFor(d.table, t);
      if (!src) return;
      var table = el('table', 'tt');
      var note = dayLabel(d.table, t);
      var cap = el('caption', null, d.from + ' → ' + d.to + (note ? '（' + note + '）' : ''));
      table.appendChild(cap);
      Object.keys(src).map(Number).sort(function (a, b) { return a - b; }).forEach(function (h) {
        var tr = el('tr');
        tr.appendChild(el('th', null, h + '時'));
        var td = el('td');
        src[h].forEach(function (mi, k) {
          if (k) td.appendChild(document.createTextNode('　'));
          var isNow = (h === t.hh && h * 60 + mi >= t.minutes);
          var s = el('span', isNow ? 'mnow' : null, pad(mi));
          td.appendChild(s);
        });
        tr.appendChild(td);
        table.appendChild(tr);
      });
      body.appendChild(table);
    });

    if (m.note) body.appendChild(el('p', 'sub', m.note));
    $('modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('modal').hidden = true;
    document.body.style.overflow = '';
  }

  /* ================= バイクシェア ================= */
  function haversine(a, b, c, d) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (c - a) * toR, dLon = (d - b) * toR;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function fetchPorts() {
    var B = CFG.bikeshare;
    if (!B.enabled) return Promise.resolve(null);
    if (MOCK) return Promise.resolve(mockPorts());
    return Promise.all([
      fetch(B.infoUrl, { cache: 'no-store' }).then(function (r) { return r.json(); }),
      fetch(B.statusUrl, { cache: 'no-store' }).then(function (r) { return r.json(); }),
    ]).then(function (res) {
      var info = res[0].data.stations, status = res[1].data.stations;
      var byId = {};
      status.forEach(function (s) { byId[s.station_id] = s; });
      return info.map(function (s) {
        return {
          id: s.station_id,
          name: s.name,
          dist: haversine(CFG.place.lat, CFG.place.lon, s.lat, s.lon),
          st: byId[s.station_id],
        };
      }).filter(function (s) { return s.st && s.dist <= B.radiusMeters; })
        .sort(function (x, y) { return x.dist - y.dist; })
        .slice(0, B.maxPorts);
    });
  }

  function paintPorts(list, t) {
    var card = $('share-card');
    if (!list || !list.length) { card.hidden = true; return; }
    card.hidden = false;
    $('share-updated').textContent = pad(t.hh) + ':' + pad(t.mm) + ' 更新';

    var box = $('ports');
    box.innerHTML = '';
    list.forEach(function (s) {
      var bikes = s.st.num_bikes_available;
      var docks = s.st.num_docks_available;
      var p = el('div', 'port');
      var nm = el('div', 'port-name');
      nm.appendChild(el('span', 'tag', '自転車'));
      nm.appendChild(document.createTextNode(s.name));
      p.appendChild(nm);

      var nums = el('div', 'port-nums');
      [['利用可能', bikes], ['返却可能', docks]].forEach(function (pair) {
        var n = el('div', 'port-num' + (pair[1] <= 1 ? ' is-low' : ''));
        n.appendChild(el('b', null, String(pair[1])));
        n.appendChild(el('div', 'label', pair[0]));
        nums.appendChild(n);
      });
      p.appendChild(nums);
      p.appendChild(el('div', 'port-foot', Math.round(s.dist) + ' m · 徒歩 約' + Math.max(1, Math.round(s.dist / 80)) + '分'));
      box.appendChild(p);
    });
  }

  /* ================= データバッジ ================= */
  function paintSources(ok, total, notes) {
    var pill = $('data-pill');
    $('data-pill-text').textContent = '実データ ' + ok + '/' + total;
    pill.querySelector('.dot').className = 'dot ' + (ok === total ? 'dot-ok' : ok ? 'dot-warn' : 'dot-bad');
    $('sources').textContent = notes.join(' · ');
  }

  /* ================= 起動 ================= */
  function load() {
    var t = paintClock();
    var ok = 0, total = 0, notes = [];
    state.railOk = false;

    /* シャトル時刻表は常にローカルにある */
    total++; ok++; notes.push('シャトル時刻表 ○');
    paintRoutes(t);
    $('shuttle-note').textContent = window.SHUTTLE.serviceNote;

    total += 2; // 天気（現況 + 予報）
    total += CFG.rail.enabled ? 1 : 0;
    total += CFG.bikeshare.enabled ? 1 : 0;

    var jobs = [];

    jobs.push(fetchWeather().then(function (w) {
      state.weather = w;
      paintWeather(w, t);
      paintBike(w, t);
      ok += 2; notes.push('天気 ○');
    }).catch(function (e) {
      console.warn(e);
      notes.push('天気 ×');
      $('wx-desc').textContent = '天気を取得できませんでした';
      $('hourly').innerHTML = '';
      $('hourly').appendChild(el('div', 'sub', '予報を取得できませんでした。時間をおいて再読み込みしてください。'));
      $('bike-reason').textContent = '天気が取れないため判定できません';
      $('bike-word').textContent = '—';
    }));

    if (CFG.rail.enabled) {
      jobs.push(fetchRail().then(function (list) {
        state.rail = Array.isArray(list) ? list : [];
        state.railOk = true;
        ok++; notes.push('運行情報 ○');
      }).catch(function (e) {
        console.warn(e);
        state.railOk = false;
        notes.push('運行情報 ×');
      }));
    }

    if (CFG.bikeshare.enabled) {
      jobs.push(fetchPorts().then(function (list) {
        state.ports = list;
        paintPorts(list, t);
        if (list && list.length) { ok++; notes.push('バイクシェア ○'); }
        else { notes.push('バイクシェア ×'); }
      }).catch(function (e) {
        console.warn(e);
        $('share-card').hidden = true;
        notes.push('バイクシェア ×');
      }));
    }

    Promise.all(jobs).then(function () {
      /* 運行情報は天気（雨量）も使うので、両方そろってから描く */
      if (state.railOk) paintRail(state.rail, t, state.weather);
      else paintRailUnavailable();
      paintSources(ok, total, notes);
    });
  }

  /* ---------- モックデータ（?mock=1 のときだけ / 表示確認用） ---------- */
  function mockWeather() {
    var t = tokyoNow(), times = [], temp = [], pop = [], pr = [], wc = [], ws = [], wg = [], uv = [];
    var start = new Date(Date.UTC(t.y, t.mo - 1, t.d, 0, 0, 0));
    for (var i = 0; i < 72; i++) {
      var d = new Date(start.getTime() + i * 3600000);
      times.push(d.toISOString().slice(0, 10) + 'T' + pad(d.getUTCHours()) + ':00');
      var h = d.getUTCHours();
      temp.push(23 + Math.sin(i / 4) * 2);
      pop.push([50, 80, 0, 80, 80, 80, 80, 50][i % 8]);
      pr.push([0.3, 1.1, 0, 1.2, 2.0, 1.5, 3.6, 0.9][i % 8]);
      wc.push(i % 8 === 2 ? 3 : 63);
      ws.push(5 + (i % 5));
      wg.push(9 + (i % 6));
      uv.push(h > 6 && h < 18 ? 4.2 : 0);
    }
    return {
      current: {
        temperature_2m: 23.3, apparent_temperature: 23.3, precipitation: 0.3,
        weather_code: 63, wind_speed_10m: 7.1, wind_direction_10m: 45,
        wind_gusts_10m: 11, is_day: 1,
      },
      hourly: {
        time: times, temperature_2m: temp, precipitation_probability: pop,
        precipitation: pr, weather_code: wc, wind_speed_10m: ws,
        wind_gusts_10m: wg, uv_index: uv,
      },
    };
  }
  function mockRail() {
    return [
      { name: '横須賀線', company: 'JR東日本', source: 'mock' },
      { name: '京急本線', company: '京浜急行電鉄', source: 'mock' },
    ];
  }
  function mockPorts() {
    return [
      { id: 'a', name: 'C5-12.第2東運ビル', dist: 180, st: { num_bikes_available: 6, num_docks_available: 7 } },
      { id: 'b', name: 'C5-18.パークタワー品川ベイワード', dist: 320, st: { num_bikes_available: 10, num_docks_available: 15 } },
      { id: 'c', name: 'C5-62.ロイヤルパークス品川', dist: 460, st: { num_bikes_available: 6, num_docks_available: 3 } },
    ];
  }

  /* ---------- 配線 ---------- */
  if (MOCK) $('mock-banner').hidden = false;
  document.querySelector('.ico-rain').innerHTML = GLYPH.rain;
  document.querySelector('.ico-wind').innerHTML = GLYPH.wind;

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('modal').hidden) closeModal();
  });

  paintClock();
  load();

  var lastMinute = -1;
  setInterval(function () {
    var t = paintClock();
    if (t.minutes !== lastMinute) {       // 分が変わったときだけ発車案内を描き直す
      lastMinute = t.minutes;
      paintRoutes(t);
    }
  }, 1000);

  setInterval(load, REFRESH_MS);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) load();
  });
})();
