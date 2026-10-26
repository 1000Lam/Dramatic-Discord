(function () {
  /* ===== ค่าคงที่ ต้องตรงกับ JekGroup.ino ===== */
  var AIR_VALUE = 1023;     // const int AIR_VALUE
  var WATER_VALUE = 320;    // const int WATER_VALUE
  var STAGE0_BELOW = 15;    // percent < 15  -> ( X _ X )
  var DRY_BELOW = 30;       // percent < 30  -> ( . _ . ) และ Discord = Dry
  var WET_ABOVE = 85;       // percent > 85  -> ( > o < ) และ Discord = Wet

  var slider = document.getElementById('slider');
  var pct = document.getElementById('pct');
  var raw = document.getElementById('raw');
  var status = document.getElementById('status');
  var gauge = document.getElementById('gauge');
  var plant = document.getElementById('plant');
  var soil = document.getElementById('soil');
  var cracks = document.getElementById('cracks');
  var puddle = document.getElementById('puddle');
  var desc = document.getElementById('desc');
  var lcd0 = document.getElementById('lcd0');
  var lcd1 = document.getElementById('lcd1');
  var discord = document.getElementById('discord');
  var chips = document.querySelectorAll('.chip');

  /* ข้อความบน LCD (ตรงกับ lcd.setCursor / lcd.print ในโค้ด) */
  var LCD = {
    stage0: { face: '( X _ X )', msg: 'Water me, PLZ!', c0: 3, c1: 1 },
    stage1: { face: '( . _ . )', msg: 'Getting dry..', c0: 3, c1: 2 },
    stage2: { face: '( O v O )', msg: 'I\'m refreshed!', c0: 3, c1: 1 },
    stage3: { face: '( > o < )', msg: 'Too much water!', c0: 3, c1: 1 }
  };

  var STATUS = {
    stage0: 'แห้งมาก (Water me, PLZ!)',
    stage1: 'เริ่มแห้ง (Getting dry..)',
    stage2: 'พอดี (I\'m refreshed!)',
    stage3: 'ชื้นมากไป (Too much water!)'
  };

  var TEXT = {
    stage0: '( X _ X ) Water me, PLZ! - ดินแห้งมาก ควรรดน้ำทันที',
    stage1: '( . _ . ) Getting dry.. - ดินเริ่มแห้ง ความชื้นเริ่มลดลง',
    stage2: '( O v O ) I\'m refreshed! - ความชื้นกำลังพอดี ต้นไม้สดชื่น',
    stage3: '( > o < ) Too much water! - น้ำมากเกินไป ดินแฉะระวังรากเน่า'
  };

  /* ตรงกับ updateLcdEmoticon() */
  function getStage(p) {
    if (p < STAGE0_BELOW) return 'stage0';
    if (p < DRY_BELOW) return 'stage1';
    if (p <= WET_ABOVE) return 'stage2';
    return 'stage3';
  }

  /* ตรงกับ sendToDiscord() */
  function getDiscord(p) {
    if (p < DRY_BELOW) return { s: 'Dry', e: '🏜️', a: 'Your plant is thirsty. Time to water it!' };
    if (p > WET_ABOVE) return { s: 'Wet', e: '🌊', a: 'Plenty of water. No need to water for now.' };
    return { s: 'Happy', e: '🌱', a: 'Moisture level is just right.' };
  }

  /* ตรงกับ makeBar() */
  function makeBar(p) {
    var filled = Math.floor((p + 5) / 10), s = '';
    for (var i = 0; i < 10; i++) s += i < filled ? '🟦' : '⬛';
    return s;
  }

  /* map() กลับด้าน: percent -> ค่า ADC ดิบ (AIR_VALUE -> 0%, WATER_VALUE -> 100%) */
  function percentToRaw(p) {
    return Math.round(AIR_VALUE + (WATER_VALUE - AIR_VALUE) * p / 100);
  }

  function pad16(text, col) {
    var s = new Array(col + 1).join(' ') + text;
    while (s.length < 16) s += ' ';
    return s.slice(0, 16);
  }

  function update() {
    var v = Number(slider.value);
    var state = getStage(v);

    pct.textContent = v;
    raw.textContent = percentToRaw(v);
    draw(v, state);
    gauge.setAttribute('data-state', state);
    status.textContent = STATUS[state];

    if (lcd0 && lcd1) {
      lcd0.textContent = pad16(LCD[state].face, LCD[state].c0);
      lcd1.textContent = pad16(LCD[state].msg, LCD[state].c1);
    }
    if (discord) {
      var d = getDiscord(v);
      discord.textContent = d.e + ' Status: ' + d.s + ' · ' + makeBar(v) + ' ' + v + '% — ' + d.a;
    }
  }

  function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function lerp(A, B, t) { return A.map(function (x, i) { return x + (B[i] - x) * t; }); }
  function css(A, k) { k = k || 1; return 'rgb(' + A.map(function (x) { return Math.round(x * k); }).join(',') + ')'; }
  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function bez(p0, p1, p2, t) {
    var u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  }
  function leafD(L, W) {
    return 'M0 0C' + (L * 0.25) + ' ' + (-W) + ' ' + (L * 0.75) + ' ' + (-W * 1.05) + ' ' + L + ' 0C' + (L * 0.75) + ' ' + (W * 1.05) + ' ' + (L * 0.25) + ' ' + W + ' 0 0Z';
  }
  function leaf(pt, angle, L, W, col) {
    return '<g transform="translate(' + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1) + ') rotate(' + angle.toFixed(1) + ')">' +
      '<path class="leaf" d="' + leafD(L, W) + '" fill="' + col + '"/>' +
      '<path class="rib" d="M0 0L' + (L * 0.9).toFixed(1) + ' 0"/></g>';
  }

  function draw(v, state) {
    /* d = ความแห้ง (0 ที่ DRY_BELOW -> 1 ที่ 0%), w = ความแฉะ (0 ที่ WET_ABOVE -> 1 ที่ 100%) */
    var d = clamp((DRY_BELOW - v) / DRY_BELOW);
    var w = clamp((v - WET_ABOVE) / (100 - WET_ABOVE));
    var droop = Math.max(d, w * 0.55);

    var ok = hex(tok('--leaf-ok'));
    var leafC = d > 0 ? lerp(ok, hex(tok('--leaf-dry')), d) : lerp(ok, hex(tok('--leaf-wet')), w);
    var col = css(leafC);

    var P0 = [120, 198], P1 = [120, 140], P2 = [120 + droop * 40, 84 + droop * 34];
    var html = '<path d="M' + P0[0] + ' ' + P0[1] + 'Q' + P1[0] + ' ' + P1[1] + ' ' + P2[0] + ' ' + P2[1] +
      '" fill="none" stroke-width="5" stroke-linecap="round" stroke="' + css(leafC, 0.7) + '"/>';

    var right = [[0.30, -15, 46], [0.52, -28, 42], [0.72, -44, 36]];
    var left = [[0.38, -15, 44], [0.60, -28, 40], [0.78, -44, 34]];
    right.forEach(function (s) {
      var L = s[2] * (1 - 0.15 * d);
      html += leaf(bez(P0, P1, P2, s[0]), s[1] + droop * 105, L, L * 0.34 * (1 - 0.45 * d), col);
    });
    left.forEach(function (s) {
      var L = s[2] * (1 - 0.15 * d);
      html += leaf(bez(P0, P1, P2, s[0]), 180 - (s[1] + droop * 105), L, L * 0.34 * (1 - 0.45 * d), col);
    });
    var tl = 38 * (1 - 0.15 * d);
    html += leaf(P2, -90 + droop * 105, tl, tl * 0.34 * (1 - 0.45 * d), col);
    plant.innerHTML = html;

    var soilC = v <= 50
      ? lerp(hex(tok('--soil-dry')), hex(tok('--soil-ok')), v / 50)
      : lerp(hex(tok('--soil-ok')), hex(tok('--soil-wet')), (v - 50) / 50);
    soil.setAttribute('fill', css(soilC));
    cracks.style.opacity = d.toFixed(2);
    puddle.style.opacity = (w * 0.7).toFixed(2);

    desc.textContent = TEXT[state];
    chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-state') === state ? 'true' : 'false'); });
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      slider.value = c.getAttribute('data-v');
      update();
    });
  });

  slider.addEventListener('input', update);
  try {
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
  } catch (e) {}
  update();
})();
