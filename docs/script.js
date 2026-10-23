(function () {
  var slider = document.getElementById('slider');
  var pct = document.getElementById('pct');
  var raw = document.getElementById('raw');
  var status = document.getElementById('status');
  var gauge = document.getElementById('gauge');

  // ตัวอย่างการแปลงค่า: ดินแห้งอ่านได้ประมาณ 1023 ดินเปียกอ่านได้ประมาณ 300
  var RAW_DRY = 1023, RAW_WET = 300;

  function update() {
    var v = Number(slider.value);
    var r = Math.round(RAW_DRY - (v / 100) * (RAW_DRY - RAW_WET));
    var state = v < 30 ? 'dry' : v > 70 ? 'wet' : 'ok';
    pct.textContent = v;
    raw.textContent = r;
    draw(v, state);
    gauge.setAttribute('data-state', state);
    status.textContent = state === 'dry' ? 'แห้ง ควรรดน้ำ' : state === 'wet' ? 'ชื้นมาก' : 'ความชื้นพอดี';
  }
  var plant = document.getElementById('plant');
  var soil = document.getElementById('soil');
  var cracks = document.getElementById('cracks');
  var puddle = document.getElementById('puddle');
  var desc = document.getElementById('desc');
  var chips = document.querySelectorAll('.chip');

  var TEXT = {
    dry: 'ใบเหี่ยวและห้อยลง สีใบซีดเป็นน้ำตาล ดินแห้งแตก ควรรดน้ำ',
    ok: 'ใบตั้งชูขึ้น สีเขียวสด ลำต้นตรง ดินชื้นพอดี',
    wet: 'ใบเหลืองและห้อยลง ดินแฉะมีน้ำขัง รากเสี่ยงเน่า ควรงดรดน้ำ'
  };

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
    var d = clamp((30 - v) / 30);
    var w = clamp((v - 70) / 30);
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