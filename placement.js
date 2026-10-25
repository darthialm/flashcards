// Placement : simulateur de manœuvre vu de dessus.
// Un rôle (chef ou équipier, BAT ou BAL), une consigne : ordre préparatoire « … en reconnaissance »,
// matériel, reconnaissance, ordre d'exécution « … Établissez ! », pose des tuyaux, mise en eau, bilan.
// Couronnes : on choisit la direction, le tuyau part tout droit (20 m), puis on modèle la réserve.
// Dévidoir (mobile ou tournant) : on déroule en marchant.
(function () {
  "use strict";

  // ===================== Règles (modifiables) =====================
  var CFG = {
    TUYAU: 20,          // m, un tuyau en couronne
    LDT: 60,            // m de LDT sur le dévidoir tournant (40 à 80 m, guide ETB-1)
    DEVIDOIR: 200,      // m, un dévidoir mobile (guide ETB-2)
    SEG: 0.5,           // m, finesse de la simulation des tuyaux lancés
    RES_RAYON: 7,       // m autour du point d'attaque où l'on compte la réserve (hypothèse)
    RES_MIN: 6,         // m de tuyau minimum dans ce rayon pour une réserve correcte (hypothèse)
    PLI: 95             // degrés : au-delà, le tuyau fait un pli (l'eau passe mal)
  };
  var RULES = [
    "Tu ne joues qu'un rôle. L'autre binôme et ton coéquipier font leur part tout seuls.",
    "Ordre préparatoire « … en reconnaissance » : il indique le matériel à emporter (guide ETEX-STR-ETB §6.1).",
    "Ordre d'exécution : situation, mission, point d'attaque, prise d'eau, accès, sécurité… « Établissez ! » (§6.2).",
    "BAT, ligne d'attaque en couronnes : chef = lance + 1 tuyau de 45 ; équipier = 2 tuyaux de 45 + commande. ARI et lampe pour les deux (ETB-3 et tes notes).",
    "LDT (chef BAT) : lance du dévidoir tournant, réserve de 2 à 3 tours sur l'épaule (ETB-1).",
    "BAL alimentation en couronnes : chef = clé (poteau ou bouche) + retenue si bouche + 1 tuyau de 70 ; équipier = 2 tuyaux de 70 (tes notes, ETB-4).",
    "BAL au dévidoir : le dévidoir, 1 retenue si bouche, la clé (tes notes). Division d'alimentation : au pied du bâtiment (ETB-2).",
    "Division au dévidoir (cas du stage) : de la division au fourgon, raccord en refoulement ; l'autre raccord en alimentation et on repart vers la prise d'eau avec le même dévidoir (ETB-4, nota).",
    "Couronnes lancées du point d'attaque vers le fourgon (BAT) et de la prise d'eau vers le fourgon (BAL) : sens supposé, à confirmer.",
    "Réserve (hypothèse) : au moins " + CFG.RES_MIN + " m de tuyau à moins de " + CFG.RES_RAYON + " m du point d'attaque, qui tourne sans croiser ni plier.",
    "Ne pas établir devant les ouvrants (cône d'environ 30°, ETEX-STR-ETB §4.1).",
    "Pas de croisement de tuyaux (enchevêtrés) ni de pli serré (> " + CFG.PLI + "°).",
    "À la fin : le chef BAT demande l'eau (« Conducteur, de chef d'équipe BAT : ouvrez ! ») ; un binôme qui a fini rend compte au chef d'agrès (§6)."
  ];

  var NS = "http://www.w3.org/2000/svg";
  var WORLD = { w: 120, h: 75 };
  var svg = document.getElementById("map");
  var panel = document.getElementById("panel");
  document.getElementById("rules").innerHTML = RULES.map(function (r) { return "<li>" + r + "</li>"; }).join("");

  // ===================== Outils =====================
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, s, x, y, size, opts) {
    opts = opts || {};
    var e = el("text", { x: x, y: y, "font-size": size, "text-anchor": opts.anchor || "middle", "font-family": "Barlow, sans-serif", "font-weight": opts.weight || 600, fill: opts.fill || "#222" }, parent);
    if (opts.stroke) { e.setAttribute("stroke", opts.stroke); e.setAttribute("stroke-width", opts.sw || 0.25); e.setAttribute("paint-order", "stroke"); }
    e.textContent = s; return e;
  }
  function inRect(p, r) { return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h; }
  function segInter(a, b, c, d) {
    var d1 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    var d2 = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
    var d3 = (d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x);
    var d4 = (d.x - c.x) * (b.y - c.y) - (d.y - c.y) * (b.x - c.x);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function segRect(a, b, r) {
    if (inRect(a, r) || inRect(b, r)) return true;
    var p = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
    for (var i = 0; i < 4; i++) if (segInter(a, b, p[i], p[(i + 1) % 4])) return true;
    return false;
  }
  function pushOut(p, r) {
    if (!inRect(p, r)) return;
    var dl = p.x - r.x, dr = r.x + r.w - p.x, dt = p.y - r.y, db = r.y + r.h - p.y, m = Math.min(dl, dr, dt, db), e = 0.02;
    if (m === dl) p.x = r.x - e; else if (m === dr) p.x = r.x + r.w + e; else if (m === dt) p.y = r.y - e; else p.y = r.y + r.h + e;
  }
  function polyLen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
  // Rééchantillonne une polyligne tous les `step` mètres.
  function resample(pts, step) {
    var out = [{ x: pts[0].x, y: pts[0].y }], acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], d = dist(a, b), t = step - acc;
      while (t <= d) { out.push({ x: a.x + (b.x - a.x) * t / d, y: a.y + (b.y - a.y) * t / d }); t += step; }
      acc = d - (t - step);
    }
    return out;
  }
  function smoothD(p) {
    if (p.length < 2) return "";
    var f = function (v) { return v.toFixed(2); };
    var d = "M" + f(p[0].x) + " " + f(p[0].y);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += " C" + f(p1.x + (p2.x - p0.x) / 6) + " " + f(p1.y + (p2.y - p0.y) / 6) + " " + f(p2.x - (p3.x - p1.x) / 6) + " " + f(p2.y - (p3.y - p1.y) / 6) + " " + f(p2.x) + " " + f(p2.y);
    }
    return d;
  }

  // ===================== Rôles, matériel, scénarios =====================
  var ROLES = {
    cbat: { label: "Chef d'équipe BAT", short: "Chef BAT", bin: "BAT", desc: "Binôme d'attaque, tu tiens la lance." },
    ebat: { label: "Équipier BAT", short: "Équipier BAT", bin: "BAT", desc: "Binôme d'attaque, tu établis vers l'engin." },
    cbal: { label: "Chef d'équipe BAL", short: "Chef BAL", bin: "BAL", desc: "Binôme d'alimentation, prise d'eau et division." },
    ebal: { label: "Équipier BAL", short: "Équipier BAL", bin: "BAL", desc: "Binôme d'alimentation, tu raccordes à l'engin." }
  };
  var ITEMS = [
    ["ari", "ARI"], ["lampe", "Lampe"], ["radio", "Radio"], ["lance", "Lance"],
    ["t45", "Tuyau de 45 (couronne)"], ["t70", "Tuyau de 70 (couronne)"], ["dev", "Dévidoir mobile"],
    ["div", "Division"], ["ret", "Retenue"], ["clePot", "Clé de poteau"], ["cleBou", "Clé de bouche"],
    ["cmd", "Commande"], ["col", "Collecteur"]
  ];
  var SCENARIOS = {
    ligne: { roles: ["cbat", "ebat"], title: "Ligne d'attaque sur l'engin, tuyaux en couronnes" },
    ldt: { roles: ["cbat"], title: "Lance du dévidoir tournant (LDT)" },
    division: { roles: ["cbal", "ebal"], title: "LDV 500 sur division d'alimentation, dévidoir mobile" },
    alimC: { roles: ["cbal", "ebal"], title: "Alimentation de l'engin, tuyaux en couronnes" },
    alimD: { roles: ["cbal", "ebal"], title: "Alimentation de l'engin au dévidoir mobile" }
  };

  // ===================== État =====================
  var G = null;          // partie en cours
  var role = null;
  var mode = "none";     // none | aim | model | walk | click
  var handlers = {};     // callbacks du mode courant
  var layers = {};
  var cam = { x: 0, y: 0, w: 120, h: 75 };

  // ===================== Monde =====================
  function genWorld(kind) {
    var w = {};
    w.bw = 30; w.bx = rand(16, 74); w.by = 8; w.fy = 34;
    w.door = { x: w.bx + rand(9, 21), y: w.fy };
    w.attack = { x: w.door.x, y: w.fy + 0.9, id: "attaque", label: "point d'attaque" };
    w.windows = [];
    for (var x = w.bx + 3; x <= w.bx + w.bw - 2.5; x += 5.2) if (Math.abs(x - w.door.x) >= 5) w.windows.push(x);
    w.fireWin = pick(w.windows);
    w.fenceY = 51; w.gateW = 3.6;
    w.gate = { x: clamp(w.door.x + rand(-3, 3), 6, 114), y: 51 };
    var tx;
    if (kind === "alimD") {
      var left = Math.random() < 0.5;
      tx = left ? rand(10, 26) : rand(94, 110);
    } else {
      var off = rand(16, 27) * (Math.random() < 0.5 ? -1 : 1);
      if (w.gate.x + off < 9 || w.gate.x + off > 111) off = -off;
      tx = clamp(w.gate.x + off, 9, 111);
    }
    w.truck = { x: tx - 4.8, y: 56.2, w: 9.6, h: 3.3, cx: tx };
    w.portR = { x: tx - 0.8, y: 55.6, id: "R", label: "refoulement" };
    w.portA = { x: tx + 1.6, y: 55.6, id: "A", label: "alimentation" };
    w.portL = { x: tx + 3.9, y: 55.6, id: "L", label: "dévidoir tournant" };
    var dmin = 42, dmax = 54;
    if (kind === "alimD") { dmin = 60; dmax = 86; }
    var sides = [-1, 1].sort(function () { return Math.random() - 0.5; }), hx = null;
    for (var i = 0; i < 2 && hx === null; i++) {
      var s = sides[i], room = s < 0 ? tx - 4 : 116 - tx;
      if (room >= dmin) hx = tx + s * rand(dmin, Math.min(dmax, room));
    }
    if (hx === null) hx = tx < 60 ? Math.min(116, tx + dmin) : Math.max(4, tx - dmin);
    w.hydType = Math.random() < 0.5 ? "poteau" : "bouche";
    w.hyd = { x: hx, y: 53.1, id: "H", label: w.hydType };
    w.obst = [
      { x: w.bx, y: w.by, w: w.bw, h: w.fy - w.by, name: "bâtiment" },
      { x: -5, y: w.fenceY - 0.3, w: w.gate.x - w.gateW / 2 + 5, h: 0.6, name: "clôture" },
      { x: w.gate.x + w.gateW / 2, y: w.fenceY - 0.3, w: 130 - w.gate.x, h: 0.6, name: "clôture" },
      { x: w.truck.x, y: w.truck.y, w: w.truck.w, h: w.truck.h, name: "fourgon" }
    ];
    return w;
  }
  function blocked(a, b) {
    if (b.x < 0.3 || b.y < 0.3 || b.x > WORLD.w - 0.3 || b.y > WORLD.h - 0.3) return true;
    for (var i = 0; i < G.w.obst.length; i++) if (segRect(a, b, G.w.obst[i])) return true;
    return false;
  }
  // Chemin simple : passe par le portillon si on change de côté de la clôture.
  function route(a, b) {
    var w = G.w, pts = [a];
    var sa = a.y < w.fenceY, sb = b.y < w.fenceY;
    if (Math.abs(a.y - w.fy) < 1.5) pts.push({ x: a.x, y: a.y + 2.2 });
    if (sa !== sb) {
      var g1 = { x: w.gate.x, y: w.fenceY + (sa ? -1.6 : 1.6) }, g2 = { x: w.gate.x, y: w.fenceY + (sa ? 1.6 : -1.6) };
      pts.push(g1, g2);
    }
    if (Math.abs(b.y - w.fy) < 1.5) pts.push({ x: b.x, y: b.y + 2.2 });
    pts.push(b);
    return pts;
  }

  // ===================== Dessin du décor =====================
  function drawWorld() {
    svg.innerHTML = "";
    var w = G.w;
    var defs = el("defs", {}, svg);
    var pg = el("pattern", { id: "grass", width: 3, height: 3, patternUnits: "userSpaceOnUse" }, defs);
    el("rect", { width: 3, height: 3, fill: "#86ad6f" }, pg);
    el("path", { d: "M0.4 0.8l0.2-0.5M1.9 2.2l0.2-0.5M2.4 0.9l0.15-0.45M1 2.7l0.2-0.4", stroke: "#6f9858", "stroke-width": 0.12 }, pg);
    var pv = el("pattern", { id: "pav", width: 1.2, height: 1.2, patternUnits: "userSpaceOnUse" }, defs);
    el("rect", { width: 1.2, height: 1.2, fill: "#d9d4ca" }, pv);
    el("path", { d: "M0 0H1.2M0 0V1.2", stroke: "#c4beb2", "stroke-width": 0.06 }, pv);
    var pr = el("pattern", { id: "roof", width: 1.4, height: 1.4, patternUnits: "userSpaceOnUse", patternTransform: "rotate(0)" }, defs);
    el("rect", { width: 1.4, height: 1.4, fill: "#8b5a45" }, pr);
    el("path", { d: "M0 0.7H1.4", stroke: "#7a4b38", "stroke-width": 0.18 }, pr);
    var rg = el("radialGradient", { id: "fireg" }, defs);
    el("stop", { offset: "0", "stop-color": "#fff2a8" }, rg); el("stop", { offset: ".45", "stop-color": "#ff9a2e" }, rg); el("stop", { offset: "1", "stop-color": "#e8401c", "stop-opacity": "0" }, rg);
    var sh = el("filter", { id: "shadow", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
    el("feDropShadow", { dx: 0.5, dy: 0.7, stdDeviation: 0.5, "flood-opacity": 0.35 }, sh);

    var bg = el("g", {}, svg);
    el("rect", { x: -10, y: -10, width: 140, height: 95, fill: "url(#grass)" }, bg);
    // trottoirs et route
    el("rect", { x: -10, y: w.fenceY + 0.3, width: 140, height: 3.9, fill: "url(#pav)" }, bg);
    el("rect", { x: -10, y: 55.2, width: 140, height: 10.4, fill: "#5b5d61" }, bg);
    el("rect", { x: -10, y: 55.0, width: 140, height: 0.35, fill: "#bdb8ad" }, bg);
    el("rect", { x: -10, y: 65.5, width: 140, height: 0.35, fill: "#bdb8ad" }, bg);
    el("rect", { x: -10, y: 65.85, width: 140, height: 3.5, fill: "url(#pav)" }, bg);
    for (var i = -2; i < 26; i++) el("rect", { x: i * 5.5, y: 60.25, width: 3, height: 0.25, fill: "#efefe6" }, bg);
    // allée du portillon à la porte
    var path = "M" + (w.door.x - 1.1) + " " + w.fy + " L" + (w.door.x + 1.1) + " " + w.fy + " L" + (w.gate.x + 1.3) + " " + w.fenceY + " L" + (w.gate.x - 1.3) + " " + w.fenceY + "Z";
    el("path", { d: path, fill: "url(#pav)", opacity: 0.95 }, bg);
    // haies/arbres décoratifs
    [[w.bx - 6, 20], [w.bx + w.bw + 6, 26], [w.bx - 9, 44], [w.bx + w.bw + 9, 44]].forEach(function (t) {
      if (t[0] < 2 || t[0] > 118) return;
      el("circle", { cx: t[0] + 0.5, cy: t[1] + 0.7, r: 3, fill: "#000", opacity: 0.18 }, bg);
      el("circle", { cx: t[0], cy: t[1], r: 3, fill: "#4f7d3e" }, bg);
      el("circle", { cx: t[0] - 0.8, cy: t[1] - 0.8, r: 1.6, fill: "#5f9149" }, bg);
    });
    // bâtiment
    var b = el("g", { filter: "url(#shadow)" }, bg);
    el("rect", { x: w.bx, y: w.by, width: w.bw, height: w.fy - w.by, fill: "url(#roof)", stroke: "#5f3a2b", "stroke-width": 0.3 }, b);
    el("line", { x1: w.bx, y1: (w.by + w.fy) / 2, x2: w.bx + w.bw, y2: (w.by + w.fy) / 2, stroke: "#5f3a2b", "stroke-width": 0.35 }, bg);
    el("rect", { x: w.bx, y: w.fy - 0.5, width: w.bw, height: 0.5, fill: "#e8e1d3" }, bg);
    w.windows.forEach(function (x) {
      el("rect", { x: x - 1.1, y: w.fy - 0.45, width: 2.2, height: 0.5, fill: x === w.fireWin ? "#ffb347" : "#9cc5e0", stroke: "#4b6b80", "stroke-width": 0.1 }, bg);
    });
    el("rect", { x: w.door.x - 0.9, y: w.fy - 0.55, width: 1.8, height: 0.75, fill: "#6b4423", stroke: "#3b2412", "stroke-width": 0.1 }, bg);
    txt(bg, "porte", w.door.x, w.fy + 2.1, 1.05, { fill: "#2c2a26", stroke: "#e9e4d8" });
    // feu + fumée
    var fg = el("g", {}, bg);
    el("circle", { cx: w.fireWin, cy: w.fy - 3, r: 3.2, fill: "url(#fireg)", class: "fire" }, fg);
    for (var k = 0; k < 3; k++) {
      var c = el("circle", { cx: w.fireWin + k * 0.8 - 0.8, cy: w.fy - 6 - k, r: 1.6, fill: "#555", class: "smoke" }, fg);
      c.style.animationDelay = (k * 1.3) + "s";
    }
    txt(bg, "BÂTIMENT", w.bx + w.bw / 2, w.by + 4, 1.6, { fill: "#f6e6d8", weight: 700 });
    // clôture
    w.obst.slice(1, 3).forEach(function (r) {
      el("rect", { x: r.x, y: r.y + 0.15, width: r.w, height: 0.3, fill: "#6b5a44" }, bg);
      for (var px = Math.ceil(r.x); px < r.x + r.w; px += 2) el("rect", { x: px - 0.15, y: r.y, width: 0.3, height: 0.6, fill: "#4e412f" }, bg);
    });
    txt(bg, "portillon", w.gate.x, w.fenceY - 0.9, 0.9, { fill: "#2c2a26", stroke: "#e9e4d8" });
    // fourgon
    var t = w.truck, tg = el("g", { filter: "url(#shadow)" }, bg);
    el("rect", { x: t.x, y: t.y, width: t.w, height: t.h, rx: 0.5, fill: "#c62a1b", stroke: "#7d1308", "stroke-width": 0.15 }, tg);
    el("rect", { x: t.x, y: t.y, width: 2.2, height: t.h, rx: 0.5, fill: "#a52114" }, tg);
    el("rect", { x: t.x + 0.25, y: t.y + 0.35, width: 0.7, height: t.h - 0.7, rx: 0.2, fill: "#9fc3dc" }, tg);
    el("rect", { x: t.x + 1.3, y: t.y + 0.5, width: 0.5, height: t.h - 1, fill: "#2f7de1" }, tg);
    el("rect", { x: t.x + 2.8, y: t.y + 0.6, width: 5.6, height: 0.35, fill: "#d9d9d9" }, tg);
    el("rect", { x: t.x + 2.8, y: t.y + t.h - 0.95, width: 5.6, height: 0.35, fill: "#d9d9d9" }, tg);
    for (var r2 = 0; r2 < 9; r2++) el("rect", { x: t.x + 3 + r2 * 0.65, y: t.y + 0.6, width: 0.12, height: t.h - 1.2, fill: "#bdbdbd" }, tg);
    txt(bg, "FOURGON", t.cx + 0.6, t.y + t.h + 1.3, 1.1, { fill: "#fff", weight: 700 });
    // sorties de pompe
    [[w.portR, "#2f6fb3", "R"], [w.portA, "#2e9b55", "A"], [w.portL, "#b8322a", "LDT"]].forEach(function (p) {
      el("circle", { cx: p[0].x, cy: p[0].y, r: 0.55, fill: "#e7c46a", stroke: p[1], "stroke-width": 0.3 }, bg);
      txt(bg, p[2], p[0].x, p[0].y - 0.9, 0.85, { fill: p[1], stroke: "#fff", weight: 700 });
    });
    // prise d'eau
    var h = w.hyd;
    if (w.hydType === "poteau") {
      el("circle", { cx: h.x, cy: h.y, r: 0.75, fill: "#d8261b", stroke: "#7d1308", "stroke-width": 0.2 }, bg);
      el("circle", { cx: h.x, cy: h.y, r: 0.3, fill: "#f2c94c" }, bg);
    } else {
      el("rect", { x: h.x - 0.7, y: h.y - 0.45, width: 1.4, height: 0.9, fill: "#3b3b3b", stroke: "#111", "stroke-width": 0.12 }, bg);
      el("path", { d: "M" + (h.x - 0.5) + " " + h.y + "H" + (h.x + 0.5), stroke: "#888", "stroke-width": 0.12 }, bg);
    }
    txt(bg, w.hydType === "poteau" ? "POTEAU" : "BOUCHE", h.x, h.y - 1.2, 1.05, { fill: "#fff", weight: 700, stroke: "#333", sw: 0.3 });
    // échelle
    el("rect", { x: 2, y: 71.6, width: 20, height: 0.45, fill: "#222" }, bg);
    txt(bg, "20 m = 1 tuyau", 12, 71.1, 1.0, { fill: "#222", stroke: "#e9e4d8" });

    layers.marks = el("g", {}, svg);
    layers.hoses = el("g", {}, svg);
    layers.ui = el("g", {}, svg);
    layers.figs = el("g", {}, svg);
  }

  // ===================== Caméra =====================
  var camAnim = null;
  function setCam(c) { cam = c; svg.setAttribute("viewBox", c.x.toFixed(2) + " " + c.y.toFixed(2) + " " + c.w.toFixed(2) + " " + c.h.toFixed(2)); }
  function focus(pts, pad, instant) {
    if (!instant && G) { G.focusBase = pts.slice(); G.focusPad = pad; }
    pad = pad == null ? 6 : pad;
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    pts.forEach(function (p) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); });
    minx -= pad; miny -= pad; maxx += pad; maxy += pad;
    var ar = 16 / 10, w = maxx - minx, h = maxy - miny;
    if (w / h < ar) { var nw = h * ar; minx -= (nw - w) / 2; w = nw; } else { var nh = w / ar; miny -= (nh - h) / 2; h = nh; }
    if (w > WORLD.w) { w = WORLD.w; h = w / ar; }
    minx = clamp(minx, 0, WORLD.w - w); miny = clamp(miny, 0, WORLD.h - h);
    var target = { x: minx, y: miny, w: w, h: h };
    if (instant) { setCam(target); return; }
    var from = { x: cam.x, y: cam.y, w: cam.w, h: cam.h }, t0 = performance.now();
    if (camAnim) cancelAnimationFrame(camAnim);
    (function step(now) {
      var k = clamp((now - t0) / 650, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setCam({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (k < 1) camAnim = requestAnimationFrame(step);
    })(t0);
  }
  function refocus(extra) {
    var base = (G && G.focusBase) ? G.focusBase : [];
    var pts = base.concat(extra || []);
    var keepBase = G.focusBase, keepPad = G.focusPad;
    focus(pts, G.focusPad == null ? 6 : G.focusPad);
    G.focusBase = keepBase; G.focusPad = keepPad;
  }
  function toWorld(ev) {
    var r = svg.getBoundingClientRect();
    return { x: cam.x + (ev.clientX - r.left) * cam.w / r.width, y: cam.y + (ev.clientY - r.top) * cam.h / r.height };
  }
  function tol(px) { var r = svg.getBoundingClientRect(); return Math.max(0.9, (px || 26) * cam.w / r.width); }

  // ===================== Tuyaux =====================
  // h = { kind: "45"|"70"|"ldt"|"dev", seg, n:[{x,y}], dyn, mine, pinA, pinB, joinA, joinB, visible }
  var HOSE_STYLE = {
    "45": { w: 0.36, color: "#f3efe4" }, "70": { w: 0.52, color: "#f3efe4" },
    "ldt": { w: 0.34, color: "#b8322a" }, "dev": { w: 0.52, color: "#f3efe4" }
  };
  function newHose(kind, seg, nodes, mine) {
    var h = { kind: kind, seg: seg, n: nodes, dyn: false, mine: !!mine, pinA: null, pinB: null, joinA: null, joinB: null, visible: nodes.length, els: null };
    G.hoses.push(h); return h;
  }
  function removeHose(h) {
    if (h.els) h.els.g.remove();
    G.hoses = G.hoses.filter(function (x) { return x !== h; });
    G.hoses.forEach(function (x) { if (x.joinA && x.joinA.h === h) x.joinA = null; if (x.joinB && x.joinB.h === h) x.joinB = null; });
  }
  function renderHoses() {
    G.hoses.forEach(function (h) {
      var st = HOSE_STYLE[h.kind];
      if (!h.els) {
        var g = el("g", {}, layers.hoses);
        h.els = {
          g: g,
          glow: el("path", { fill: "none", stroke: "#ffd34d", "stroke-width": st.w + 0.55, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.8 }, g),
          out: el("path", { fill: "none", stroke: "#3b3833", "stroke-width": st.w + 0.16, "stroke-linecap": "round", "stroke-linejoin": "round" }, g),
          core: el("path", { fill: "none", stroke: st.color, "stroke-width": st.w, "stroke-linecap": "round", "stroke-linejoin": "round" }, g),
          ra: el("circle", { r: st.w * 0.85 + 0.12, fill: "#d6ad4c", stroke: "#7a5f22", "stroke-width": 0.1 }, g),
          rb: el("circle", { r: st.w * 0.85 + 0.12, fill: "#d6ad4c", stroke: "#7a5f22", "stroke-width": 0.1 }, g)
        };
      }
      var pts = h.n.slice(0, Math.max(1, h.visible));
      var d = smoothD(pts);
      h.els.glow.setAttribute("d", d); h.els.glow.style.display = h.mine ? "" : "none";
      h.els.out.setAttribute("d", d); h.els.core.setAttribute("d", d);
      h.els.ra.setAttribute("cx", pts[0].x); h.els.ra.setAttribute("cy", pts[0].y);
      var last = pts[pts.length - 1];
      h.els.rb.setAttribute("cx", last.x); h.els.rb.setAttribute("cy", last.y);
      h.els.rb.style.display = h.visible >= h.n.length ? "" : "none";
    });
  }
  function endOf(h, end) { return end === "A" ? h.n[0] : h.n[h.n.length - 1]; }

  // Simulation : contraintes de longueur (le tuyau ne s'allonge pas), raccords fixes, obstacles.
  var drag = null;
  function invMass(h, i) {
    var last = h.n.length - 1;
    if (i === 0 && h.pinA) return 0;
    if (i === last && h.pinB) return 0;
    if (drag && drag.h === h && drag.i === i) return 0;
    if (drag && drag.h2 === h && drag.i2 === i) return 0;
    return 1;
  }
  function solve(iter) {
    var dyn = G.hoses.filter(function (h) { return h.dyn; });
    for (var it = 0; it < iter; it++) {
      dyn.forEach(function (h) {
        var n = h.n, s = h.seg;
        for (var i = 0; i < n.length - 1; i++) {
          var a = n[i], b = n[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d > s && d > 1e-6) {
            var wa = invMass(h, i), wb = invMass(h, i + 1), sum = wa + wb;
            if (!sum) continue;
            var k = (d - s) / d / sum;
            a.x += dx * k * wa; a.y += dy * k * wa; b.x -= dx * k * wb; b.y -= dy * k * wb;
          }
        }
      });
      dyn.forEach(function (h) {
        var n = h.n, last = n.length - 1;
        if (h.pinA) { n[0].x = h.pinA.x; n[0].y = h.pinA.y; }
        if (h.pinB) { n[last].x = h.pinB.x; n[last].y = h.pinB.y; }
        if (h.joinB && h.joinB.h.dyn) {
          var o = endOf(h.joinB.h, h.joinB.end), m = n[last];
          var mx = (o.x + m.x) / 2, my = (o.y + m.y) / 2;
          if (drag && ((drag.h === h && drag.i === last) || (drag.h2 === h && drag.i2 === last))) { mx = drag.x; my = drag.y; }
          m.x = o.x = mx; m.y = o.y = my;
        }
        if (h.joinA && !h.joinA.h.dyn) { var oa = endOf(h.joinA.h, h.joinA.end); n[0].x = oa.x; n[0].y = oa.y; }
      });
      if (drag) { drag.h.n[drag.i].x = drag.x; drag.h.n[drag.i].y = drag.y; if (drag.h2) { drag.h2.n[drag.i2].x = drag.x; drag.h2.n[drag.i2].y = drag.y; } }
      dyn.forEach(function (h) {
        for (var i = 0; i < h.n.length; i++) {
          if (invMass(h, i) === 0) continue;
          var p = h.n[i];
          for (var j = 0; j < G.w.obst.length; j++) pushOut(p, G.w.obst[j]);
          p.x = clamp(p.x, 0.3, WORLD.w - 0.3); p.y = clamp(p.y, 0.3, WORLD.h - 0.3);
        }
      });
    }
  }

  // Lancer : le tuyau part tout droit depuis l'ancre ; s'il bute, le reste s'entasse.
  function throwNodes(anchor, dir, len, seg) {
    var N = Math.round(len / seg), pts = [{ x: anchor.x, y: anchor.y }], hit = null;
    for (var k = 1; k <= N; k++) {
      var p = { x: anchor.x + dir.x * seg * k, y: anchor.y + dir.y * seg * k };
      if (blocked(pts[pts.length - 1], p)) { hit = k; break; }
      pts.push(p);
    }
    if (hit) {
      var base = pts[pts.length - 1], nx = -dir.y, ny = dir.x;
      for (var r = pts.length; r <= N; r++) {
        var j = r - pts.length + 1, side = (j % 2 ? 1 : -1) * (0.25 + 0.08 * (j % 5));
        pts.push({ x: base.x - dir.x * 0.12 * (j % 9) + nx * side, y: base.y - dir.y * 0.12 * (j % 9) + ny * side });
      }
    }
    return { pts: pts, hit: !!hit };
  }

  // Pose automatique (coéquipier, autre binôme) le long d'un chemin, réserve en ondulations.
  function autoCurve(from, to, total, reserveAt) {
    var r = route(from, to), base = resample(r, 0.25), Lr = polyLen(base);
    if (Lr > total + 0.01) return null;
    if (total - Lr < 0.3) return resample(base, CFG.SEG);
    var span = Math.min(Lr * 0.8, 22), lambda = 5;
    var startS = reserveAt === "end" ? Lr - span - 1.5 : 1.5;
    startS = clamp(startS, 0, Math.max(0, Lr - span));
    function build(A) {
      var out = [], s = 0;
      for (var i = 0; i < base.length; i++) {
        if (i > 0) s += dist(base[i - 1], base[i]);
        var p = base[i], q = base[Math.min(i + 1, base.length - 1)], pp = base[Math.max(i - 1, 0)];
        var tx = q.x - pp.x, ty = q.y - pp.y, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
        var off = 0;
        if (s >= startS && s <= startS + span) {
          var u = (s - startS) / span;
          off = A * Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * (s - startS) / lambda);
          var gd = dist(p, G.w.gate), ed = Math.min(dist(p, from), dist(p, to));
          off *= clamp((gd - 2) / 2.5, 0, 1) * clamp((ed - 1) / 2, 0, 1);
        }
        var q2 = { x: p.x + nx * off, y: p.y + ny * off };
        if (p.y > G.w.fenceY + 0.3 && p.y < 55.4) q2.y = clamp(q2.y, G.w.fenceY + 0.9, 54.9);
        out.push(q2);
      }
      return out;
    }
    var lo = 0, hi = 6, best = build(hi);
    if (polyLen(best) < total) { lambda = 3.4; best = build(hi); }
    if (polyLen(best) < total) { lambda = 2.4; best = build(hi); }
    for (var it = 0; it < 30; it++) {
      var mid = (lo + hi) / 2, c = build(mid);
      if (polyLen(c) < total) lo = mid; else { hi = mid; best = c; }
    }
    var res = resample(best, CFG.SEG);
    // nettoie les points entrés dans un obstacle
    res.forEach(function (p) { G.w.obst.forEach(function (o) { pushOut(p, o); }); });
    return res;
  }
  function splitHoses(pts, kind, count) {
    var per = Math.round(CFG.TUYAU / CFG.SEG), out = [];
    for (var c = 0; c < count; c++) {
      var part = pts.slice(c * per, (c + 1) * per + 1);
      if (part.length < 2) break;
      out.push(newHose(kind, CFG.SEG, part, false));
    }
    return out;
  }
  async function growHoses(list, ms) {
    list.forEach(function (h) { h.visible = 1; });
    renderHoses();
    for (var i = 0; i < list.length; i++) {
      var h = list[i], t0 = performance.now(), dur = ms / list.length;
      await new Promise(function (res) {
        (function step(now) {
          var k = clamp((now - t0) / dur, 0, 1);
          h.visible = Math.max(1, Math.round(k * h.n.length));
          renderHoses();
          if (k < 1) requestAnimationFrame(step); else res();
        })(t0);
      });
    }
  }

  // ===================== Évaluation de la pose =====================
  function evaluate(mine, opts) {
    var out = [], w = G.w;
    // croisements
    var segs = [];
    G.hoses.forEach(function (h, hi) { for (var i = 0; i < h.n.length - 1; i++) segs.push({ h: h, hi: hi, i: i, a: h.n[i], b: h.n[i + 1] }); });
    var cross = 0, crossP = null;
    for (var s1 = 0; s1 < segs.length; s1++) {
      var A = segs[s1]; if (!A.h.mine) continue;
      for (var s2 = 0; s2 < segs.length; s2++) {
        var B = segs[s2];
        if (B.h === A.h && Math.abs(B.i - A.i) <= 2) continue;
        if (B.h.mine && s2 < s1) continue;
        if (B.h !== A.h && (dist(A.a, B.a) < 0.3 || dist(A.a, B.b) < 0.3 || dist(A.b, B.a) < 0.3 || dist(A.b, B.b) < 0.3)) continue;
        if (segInter(A.a, A.b, B.a, B.b)) { cross++; crossP = A.a; }
      }
    }
    out.push(cross === 0 ? { ok: true, cat: "Tuyaux", msg: "Aucun croisement : tes tuyaux ne sont pas enchevêtrés." }
      : { ok: false, cat: "Tuyaux", msg: "Tes tuyaux se croisent (" + cross + " fois) : ils sont enchevêtrés, la réserve ne se déroulera pas proprement.", at: crossP });
    // plis
    var plis = 0, pliP = null;
    mine.forEach(function (h) {
      var k = Math.max(1, Math.round(1 / h.seg));
      for (var i = k; i < h.n.length - k; i++) {
        var a = h.n[i - k], b = h.n[i], c = h.n[i + k];
        var v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
        var l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
        if (l1 < 0.3 || l2 < 0.3) { plis++; pliP = b; i += k; continue; }
        var ang = Math.acos(clamp((v1x * v2x + v1y * v2y) / (l1 * l2), -1, 1)) * 180 / Math.PI;
        if (ang > (h.seg >= 1 ? 125 : CFG.PLI)) { plis++; pliP = b; i += k; }
      }
    });
    out.push(plis === 0 ? { ok: true, cat: "Tuyaux", msg: "Pas de pli : l'eau passe partout." }
      : { ok: false, cat: "Tuyaux", msg: "Ton tuyau fait " + plis + " pli(s) serré(s) ou un tas : l'eau passera mal. Fais des boucles plus larges.", at: pliP });
    // ouvrants
    var tan = Math.tan(15 * Math.PI / 180), danger = 0, dP = null;
    mine.forEach(function (h) {
      h.n.forEach(function (p) {
        if (dist(p, w.door) < 2.6) return;
        w.windows.forEach(function (x) {
          var dy = p.y - w.fy;
          if (dy > 0 && dy < 6 && Math.abs(p.x - x) < 1.1 + dy * tan) { danger++; dP = p; }
        });
      });
    });
    out.push(danger === 0 ? { ok: true, cat: "Sécurité", msg: "Tu n'établis pas devant les ouvrants." }
      : { ok: false, cat: "Sécurité", msg: "Ton établissement passe devant une fenêtre : en cas de phénomène thermique (cône d'environ 30°), le tuyau et toi êtes exposés.", at: dP });
    // réserve
    if (opts && opts.reserve) {
      var L = 0;
      mine.forEach(function (h) { for (var i = 0; i < h.n.length - 1; i++) if (dist(h.n[i], opts.reserve) < CFG.RES_RAYON) L += dist(h.n[i], h.n[i + 1]); });
      out.push(L >= CFG.RES_MIN ? { ok: true, cat: "Réserve", msg: "Réserve au point d'attaque : " + L.toFixed(0) + " m de tuyau à portée pour progresser." }
        : { ok: false, cat: "Réserve", msg: "Pas assez de réserve au point d'attaque (" + L.toFixed(0) + " m) : ramène des boucles près de la porte pour pouvoir progresser.", at: opts.reserve });
    }
    return out;
  }
  function flagProblems(list) {
    layers.marks.innerHTML = "";
    list.forEach(function (r) {
      if (r.ok || !r.at) return;
      el("circle", { cx: r.at.x, cy: r.at.y, r: 1.4, fill: "none", stroke: "#e5342a", "stroke-width": 0.3 }, layers.marks);
      el("circle", { cx: r.at.x, cy: r.at.y, r: 1.4, fill: "#e5342a", class: "pulse" }, layers.marks);
    });
  }

  // ===================== Interface (panneau) =====================
  var STEP_NAMES = ["Ordre préparatoire", "Matériel", "Reconnaissance", "Établissez", "Mise en eau", "Bilan"];
  function setStep(i) {
    document.getElementById("steps").innerHTML = STEP_NAMES.map(function (n, k) {
      return '<span class="' + (k < i ? "done" : k === i ? "on" : "") + '"><b>' + (k + 1) + '.</b><i> ' + n + "</i></span>";
    }).join("");
  }
  function toast(s) {
    var t = document.getElementById("toast"); t.textContent = s; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function speech(who, quote, avatar) {
    return '<div class="speaker"><div class="avatar">' + (avatar || "CA") + '</div><div><div class="who">' + esc(who) + '</div><div class="quote">' + esc(quote) + "</div></div></div>";
  }
  function show(html) { panel.innerHTML = html; }
  function waitClick(id) {
    return new Promise(function (res) { var b = document.getElementById(id); b.addEventListener("click", function (e) { e.stopPropagation(); res(); }, { once: true }); });
  }
  async function say(quote, extra, btn) {
    show(speech("Chef d'agrès", quote) + (extra ? '<div class="msg">' + extra + "</div>" : "") + '<div class="controls"><button class="primary" id="okb">' + (btn || "Compris") + "</button></div>");
    await waitClick("okb");
  }
  function record(cat, ok, msg) { G.results.push({ cat: cat, ok: ok, msg: msg }); }

  async function materialStep(exp, quote) {
    var counts = {};
    function render() {
      return speech("Chef d'agrès", quote) +
        '<div class="msg"><p><b>Qu\'emportes-tu ?</b> <span class="hint">(' + esc(ROLES[role].label) + ', seulement ton matériel)</span></p>' +
        '<div class="items">' + ITEMS.map(function (it) {
          var n = counts[it[0]] || 0;
          return '<div class="item' + (n ? " has" : "") + '"><span>' + it[1] + '</span><span class="ctr"><button data-k="' + it[0] + '" data-d="-1" aria-label="moins">−</button><b>' + n + '</b><button data-k="' + it[0] + '" data-d="1" aria-label="plus">+</button></span></div>';
        }).join("") + '</div></div><div class="controls"><button class="primary" id="okb">Je pars avec ça</button></div>';
    }
    show(render());
    await new Promise(function (res) {
      panel.onclick = function (e) {
        var b = e.target.closest("button"); if (!b || !b.isConnected) return;
        if (b.id === "okb") { panel.onclick = null; res(); return; }
        if (b.dataset.k) { counts[b.dataset.k] = clamp((counts[b.dataset.k] || 0) + (+b.dataset.d), 0, 9); show(render()); }
      };
    });
    var lines = [], allOk = true;
    ITEMS.forEach(function (it) {
      var k = it[0], e = exp[k] || [0, 0], n = counts[k] || 0;
      if (n >= e[0] && n <= e[1]) { if (n > 0) lines.push({ ok: true, msg: it[1] + " × " + n }); return; }
      allOk = false;
      var want = e[0] === e[1] ? String(e[0]) : e[0] + " ou " + e[1];
      lines.push({ ok: false, msg: it[1] + " : " + n + " pris, il fallait " + want + "." });
    });
    record("Matériel", allOk, allOk ? "Bon matériel emporté." : "Matériel incomplet ou en trop : " + lines.filter(function (l) { return !l.ok; }).map(function (l) { return l.msg; }).join(" "));
    G.counts = counts;
    show('<div class="who">Ton matériel</div><ul class="res">' + lines.map(function (l) { return '<li class="' + (l.ok ? "ok" : "ko") + '">' + esc(l.msg) + "</li>"; }).join("") +
      "</ul>" + (allOk ? '<p class="msg"><b>Parfait.</b></p>' : '<p class="msg hint">Il te manque quelque chose ou tu en as trop : regarde la liste avant de continuer.</p>') +
      '<div class="controls"><button class="primary" id="okb">En reconnaissance</button></div>');
    await waitClick("okb");
  }

  async function choice(question, options, correct, explain, cat) {
    var order = options.map(function (o, i) { return i; }).sort(function () { return Math.random() - 0.5; });
    show('<div class="who">' + esc(cat || "Question") + '</div><div class="quote">' + esc(question) + '</div><div class="choices">' +
      order.map(function (i) { return '<button data-i="' + i + '">' + esc(options[i]) + "</button>"; }).join("") + "</div>");
    var got = await new Promise(function (res) {
      panel.onclick = function (e) { var b = e.target.closest("button[data-i]"); if (b) { panel.onclick = null; res(+b.dataset.i); } };
    });
    panel.querySelectorAll("button[data-i]").forEach(function (b) {
      var i = +b.dataset.i; b.disabled = true;
      if (i === correct) b.classList.add("right"); else if (i === got) b.classList.add("wrong");
    });
    var q = function (t) { return t.charAt(0) === "«" ? t : "« " + t + " »"; };
    record(cat || "Question", got === correct, (got === correct ? "" : "Tu as répondu " + q(options[got]) + ". ") + "Bonne réponse : " + q(options[correct]) + ". " + (explain || ""));
    var div = document.createElement("div");
    div.innerHTML = '<p class="msg">' + (got === correct ? "<b>Exact.</b> " : "<b>Non.</b> ") + esc(explain || "") + '</p><div class="controls"><button class="primary" id="okb">Continuer</button></div>';
    panel.appendChild(div);
    await waitClick("okb");
  }

  // ===================== Saisie sur le plan =====================
  svg.addEventListener("pointerdown", function (ev) { if (handlers.down) { ev.preventDefault(); svg.setPointerCapture(ev.pointerId); handlers.down(toWorld(ev), ev); } });
  svg.addEventListener("pointermove", function (ev) { if (handlers.move) { ev.preventDefault(); handlers.move(toWorld(ev), ev); } });
  svg.addEventListener("pointerup", function (ev) { if (handlers.up) { ev.preventDefault(); handlers.up(toWorld(ev), ev); } });
  svg.addEventListener("pointercancel", function (ev) { if (handlers.up) handlers.up(toWorld(ev), ev); });
  function setMode(m, h) { mode = m; handlers = h || {}; layers.ui.innerHTML = ""; svg.style.cursor = m === "none" ? "default" : m === "model" ? "grab" : "crosshair"; }

  function anchorMark(p, color) {
    var g = el("g", {}, layers.ui);
    el("circle", { cx: p.x, cy: p.y, r: 1.2, fill: color || "#ffd34d", class: "pulse" }, g);
    el("circle", { cx: p.x, cy: p.y, r: 0.9, fill: "none", stroke: color || "#ffd34d", "stroke-width": 0.25 }, g);
    return g;
  }

  // Lancer une couronne depuis `anchor` (point fixe ou extrémité d'un de tes tuyaux).
  function aimThrow(anchorPt, kind) {
    return new Promise(function (res) {
      var aiming = false, arrow = null;
      setMode("aim", {
        down: function (p) { aiming = true; this.move(p); },
        move: function (p) {
          if (!aiming) return;
          var dx = p.x - anchorPt.x, dy = p.y - anchorPt.y, l = Math.hypot(dx, dy);
          if (l < 0.3) return;
          var u = { x: dx / l, y: dy / l };
          if (arrow) arrow.remove();
          arrow = el("g", {}, layers.ui);
          var sim = throwNodes(anchorPt, u, CFG.TUYAU, 1);
          var end = sim.pts[sim.pts.length - 1];
          el("line", { x1: anchorPt.x, y1: anchorPt.y, x2: anchorPt.x + u.x * CFG.TUYAU, y2: anchorPt.y + u.y * CFG.TUYAU, stroke: "#ffffff", "stroke-width": 0.22, "stroke-dasharray": "0.8 0.6", opacity: 0.75 }, arrow);
          el("circle", { cx: end.x, cy: end.y, r: 0.6, fill: sim.hit ? "#e5342a" : "#ffd34d" }, arrow);
          if (sim.hit) txt(arrow, "ça bute !", end.x, end.y - 1, 0.95, { fill: "#fff", stroke: "#e5342a", sw: 0.35, weight: 700 });
        },
        up: function (p) {
          if (!aiming) return; aiming = false;
          var dx = p.x - anchorPt.x, dy = p.y - anchorPt.y, l = Math.hypot(dx, dy);
          if (l < 0.8) { toast("Tire plus loin pour choisir la direction"); return; }
          setMode("none");
          res({ x: dx / l, y: dy / l });
        }
      });
      anchorMark(anchorPt);
    });
  }
  async function animateThrow(h) {
    var t0 = performance.now(), dur = 650;
    await new Promise(function (res) {
      (function step(now) {
        var k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 2);
        h.visible = Math.max(1, Math.round(e * h.n.length));
        renderHoses();
        if (k < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }

  // Le point tiré ne peut pas aller plus loin que la longueur de tuyau qui le relie aux raccords fixes.
  function chainOf(h) {
    var first = h;
    while (first.joinA && first.joinA.h.dyn) first = first.joinA.h;
    var list = [first];
    while (list[list.length - 1].joinB && list[list.length - 1].joinB.h.dyn) list.push(list[list.length - 1].joinB.h);
    return list;
  }
  function clampDrag(d, p) {
    var chain = chainOf(d.h), idx = 0, total = 0;
    chain.forEach(function (h) { if (h === d.h) idx = total + d.i * h.seg; total += (h.n.length - 1) * h.seg; });
    var first = chain[0], last = chain[chain.length - 1], q = { x: p.x, y: p.y };
    var anchors = [];
    if (first.pinA) anchors.push({ p: first.pinA, L: idx });
    if (last.pinB) anchors.push({ p: last.pinB, L: total - idx });
    for (var k = 0; k < 3; k++) anchors.forEach(function (a) {
      var dd = dist(q, a.p), L = Math.max(0, a.L - 0.05);
      if (dd > L) { q.x = a.p.x + (q.x - a.p.x) * L / dd; q.y = a.p.y + (q.y - a.p.y) * L / dd; }
    });
    return q;
  }

  // Modeler : on fait glisser les tuyaux (ils gardent leur longueur).
  function startModel(onRelease) {
    var raf = null;
    function loop() { solve(14); renderHoses(); raf = drag ? requestAnimationFrame(loop) : null; }
    setMode("model", {
      down: function (p) {
        var best = null, bd = tol(30);
        G.hoses.forEach(function (h) {
          if (!h.dyn) return;
          for (var i = 0; i < h.n.length; i++) {
            var d = dist(p, h.n[i]);
            if (d < bd && invMass(h, i) > 0) { bd = d; best = { h: h, i: i }; }
          }
        });
        if (!best) return;
        drag = { h: best.h, i: best.i, x: best.h.n[best.i].x, y: best.h.n[best.i].y };
        var last = best.h.n.length - 1;
        if (best.i === last && best.h.joinB && best.h.joinB.h.dyn) { drag.h2 = best.h.joinB.h; drag.i2 = best.h.joinB.end === "A" ? 0 : best.h.joinB.h.n.length - 1; }
        if (best.i === 0 && best.h.joinA && best.h.joinA.h.dyn) { drag.h2 = best.h.joinA.h; drag.i2 = best.h.joinA.end === "A" ? 0 : best.h.joinA.h.n.length - 1; }
        svg.style.cursor = "grabbing";
        if (!raf) loop();
      },
      move: function (p) { if (drag) { var q = clampDrag(drag, p); drag.x = q.x; drag.y = q.y; } },
      up: function () {
        if (!drag) return;
        var d = drag; drag = null; svg.style.cursor = "grab";
        solve(20); renderHoses();
        if (onRelease) onRelease(d);
      }
    });
  }

  // Séquence de couronnes lancées par toi.
  // o = { kind, count, start (point fixe), final: { targets:[pts], expect:id } | null, reserve: point | null, label }
  async function throwSeq(o) {
    var mine = [], k = 0;
    while (k < o.count) {
      var prev = mine[k - 1];
      var anchor = prev ? endOf(prev, "B") : o.start;
      show('<div class="who">Établissez · tuyau ' + (k + 1) + "/" + o.count + '</div><div class="quote">Lance ta couronne</div>' +
        '<p class="msg hint">' + esc(o.label || "") + '</p><p class="hint">Appuie sur le plan, tire dans la direction voulue et relâche : le tuyau part <b>tout droit</b> sur 20 m. Il ne passe ni à travers un mur, ni à travers la clôture, ni à travers le fourgon.</p>');
      var dir = await aimThrow({ x: anchor.x, y: anchor.y }, o.kind);
      var sim = throwNodes(anchor, dir, CFG.TUYAU, CFG.SEG);
      var h = newHose(o.kind, CFG.SEG, sim.pts, true);
      h.dyn = true;
      if (prev) { h.joinA = { h: prev, end: "B" }; prev.joinB = { h: h, end: "A" }; }
      else h.pinA = { x: o.start.x, y: o.start.y, id: o.start.id };
      await animateThrow(h);
      var ends = [];
      mine.concat([h]).forEach(function (x) { ends.push(x.n[0], x.n[Math.floor(x.n.length / 2)], x.n[x.n.length - 1]); });
      refocus(ends);
      if (sim.hit) toast("Ton tuyau a buté : il s'est entassé. Démêle-le ou relance.");
      var act = await modelPhase(mine.concat([h]), o, k === o.count - 1);
      if (act === "rethrow") { if (prev) prev.joinB = null; removeHose(h); continue; }
      mine.push(h); k++;
    }
    return mine;
  }
  function modelPhase(mine, o, isLast) {
    return new Promise(function (res) {
      var cur = mine[mine.length - 1];
      function free() { return !cur.pinB && !(cur.joinB); }
      function render() {
        var needConnect = isLast && o.final;
        var connected = needConnect ? !!cur.pinB : true;
        show('<div class="who">Établissez · tuyau ' + mine.length + "/" + o.count + '</div><div class="quote">Modèle ta réserve</div>' +
          '<p class="msg hint">Fais glisser le tuyau avec le doigt ou la souris : il garde sa longueur. Fais-le tourner un peu sur lui-même, sans croiser ni plier.' +
          (o.reserve ? " La réserve se fait près du point d'attaque." : "") + "</p>" +
          (needConnect ? '<p class="msg">' + (connected ? "<b>Raccordé : " + esc(cur.pinB.label) + ".</b>" : "<b>Raccorde la fin de ce tuyau :</b> fais glisser le raccord libre (au bout) sur la bonne sortie.") + "</p>" : "") +
          '<div class="controls">' +
          '<button class="ghost" id="rethrow">Relancer ce tuyau</button>' +
          (needConnect && connected ? '<button class="ghost" id="unplug">Débrancher</button>' : "") +
          (isLast ? '<button class="primary" id="done"' + (connected ? "" : " disabled") + ">Valider la pose</button>" : '<button class="primary" id="next">Lancer le tuyau suivant</button>') +
          "</div>");
      }
      render();
      panel.onclick = function (e) {
        var b = e.target.closest("button"); if (!b || b.disabled) return;
        if (b.id === "rethrow") { panel.onclick = null; setMode("none"); res("rethrow"); }
        else if (b.id === "next" || b.id === "done") { panel.onclick = null; setMode("none"); res("ok"); }
        else if (b.id === "unplug") { cur.pinB = null; cur.n[cur.n.length - 1].y -= 1.2; solve(10); renderHoses(); render(); }
      };
      startModel(function (d) {
        var last = cur.n.length - 1;
        if (isLast && o.final && d.h === cur && d.i === last && free()) {
          var p = cur.n[last], best = null, bd = tol(34);
          o.final.targets.forEach(function (t) { var dd = dist(p, t); if (dd < bd) { bd = dd; best = t; } });
          if (best && dist(clampDrag({ h: cur, i: last }, best), best) > 0.3) { toast("Trop court : le raccord n'arrive pas jusque-là"); best = null; }
          if (best) {
            cur.pinB = { x: best.x, y: best.y, id: best.id, label: best.label };
            solve(20); renderHoses(); toast("Raccordé : " + best.label);
            render();
          }
        }
      });
    });
  }

  // Dérouler en marchant (dévidoir mobile, LDT). start = point fixe ; targets = arrivées possibles.
  function walkHose(o) {
    return new Promise(function (res) {
      var h = newHose(o.kind, 1, [{ x: o.start.x, y: o.start.y }], true);
      h.pinA = { x: o.start.x, y: o.start.y, id: o.start.id };
      var walking = false, mark = null;
      function len() { return (h.n.length - 1) * h.seg; }
      function render(msg) {
        show('<div class="who">Établissez</div><div class="quote">' + esc(o.title) + "</div>" +
          '<p class="msg hint">' + esc(o.label) + '</p><p class="hint">Appuie sur le bout du tuyau (cercle jaune) et avance : le tuyau se déroule derrière toi. Relâche sur l\'arrivée pour raccorder. Longueur : <b>' + len().toFixed(0) + " / " + o.max + " m</b>.</p>" +
          (msg ? '<p class="msg">' + msg + "</p>" : "") +
          '<div class="controls"><button class="ghost" id="back">Revenir de 10 m</button><button class="ghost" id="restart">Recommencer</button></div>');
      }
      function remark() { if (mark) mark.remove(); mark = anchorMark(h.n[h.n.length - 1]); }
      render(); renderHoses(); remark();
      panel.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.id === "back") { h.n.splice(Math.max(1, h.n.length - 10)); h.visible = h.n.length; renderHoses(); remark(); render(); }
        if (b.id === "restart") { h.n.splice(1); h.visible = 1; renderHoses(); remark(); render(); }
      };
      setMode("walk", {
        down: function (p) {
          if (dist(p, h.n[h.n.length - 1]) < tol(40)) { walking = true; if (mark) mark.remove(); }
          else toast("Reprends au bout du tuyau (cercle jaune)");
        },
        move: function (p) {
          if (!walking) return;
          var last = h.n[h.n.length - 1], d = dist(last, p);
          while (d >= h.seg) {
            if (len() >= o.max) { toast("Fin du tuyau : " + o.max + " m"); walking = false; return; }
            var q = { x: last.x + (p.x - last.x) * h.seg / d, y: last.y + (p.y - last.y) * h.seg / d };
            if (blocked(last, q)) { toast("Obstacle : contourne (portillon, fourgon, mur)"); return; }
            h.n.push(q); last = q; d = dist(last, p);
          }
          h.visible = h.n.length; renderHoses();
          render();
        },
        up: function () {
          if (!walking) return; walking = false;
          var end = h.n[h.n.length - 1], best = null, bd = tol(40);
          o.targets.forEach(function (t) { var dd = dist(end, t); if (dd < bd) { bd = dd; best = t; } });
          if (best) {
            if (dist(end, best) < 0.6 && h.n.length > 1) { end.x = best.x; end.y = best.y; } else h.n.push({ x: best.x, y: best.y });
            h.visible = h.n.length;
            h.pinB = { x: best.x, y: best.y, id: best.id, label: best.label };
            renderHoses(); setMode("none"); panel.onclick = null; if (mark) mark.remove();
            toast("Raccordé : " + best.label);
            res({ hose: h, target: best });
          } else remark();
        }
      });
    });
  }

  // Cliquer un point du plan (choisir une sortie, placer la division…)
  function clickTarget(prompt, hint, targets) {
    return new Promise(function (res) {
      show('<div class="who">Établissez</div><div class="quote">' + esc(prompt) + '</div><p class="msg hint">' + esc(hint || "") + "</p>");
      if (targets) targets.forEach(function (t) { anchorMark(t, "#ffffff"); });
      setMode("click", {
        up: function (p) {
          if (targets) {
            var best = null, bd = tol(40);
            targets.forEach(function (t) { var d = dist(p, t); if (d < bd) { bd = d; best = t; } });
            if (!best) { toast("Clique sur une des sorties"); return; }
            setMode("none"); res(best);
          } else { setMode("none"); res(p); }
        }
      });
    });
  }

  // ===================== Reconnaissance =====================
  function figure(label, color) {
    var g = el("g", {}, layers.figs);
    el("circle", { cx: 0, cy: 0, r: 0.95, fill: color, stroke: "#fff", "stroke-width": 0.22 }, g);
    txt(g, label, 0, 0.32, 0.8, { fill: "#fff", weight: 700 });
    return g;
  }
  async function recon(dest, who) {
    layers.figs.innerHTML = "";
    var start = { x: G.w.truck.cx, y: 53.6 };
    var path = resample(route(start, dest), 0.3);
    var figs = [figure("CA", "#1b1b1b")].concat(who.map(function (w) { return figure(w[0], w[1]); }));
    var t0 = performance.now(), dur = 2600;
    await new Promise(function (res) {
      (function step(now) {
        var k = clamp((now - t0) / dur, 0, 1);
        figs.forEach(function (f, i) {
          var idx = clamp(Math.round(k * (path.length - 1)) - i * 5, 0, path.length - 1), p = path[idx];
          f.setAttribute("transform", "translate(" + (p.x + i * 0.9) + " " + (p.y + i * 0.4) + ")");
        });
        if (k < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }
  function clearFigs() { layers.figs.innerHTML = ""; }

  // ===================== Scénarios =====================
  function baseMat(bin, opt) {
    if (bin === "BAT") return { ari: [1, 1], lampe: [1, 1], radio: [0, 1] };
    return { ari: [0, 1], lampe: opt === "div" ? [1, 1] : [0, 1], radio: [0, 1] };
  }
  function hydMat(m, who) {
    var w = G.w;
    if (w.hydType === "poteau") m.clePot = who === "cbal" ? [1, 1] : [0, 1];
    else { m.cleBou = who === "cbal" ? [1, 1] : [0, 1]; m.ret = who === "cbal" ? [1, 1] : [0, 1]; }
    return m;
  }
  function sideOf(p) { return p.x < G.w.truck.cx ? "à gauche du fourgon" : "à droite du fourgon"; }
  function hydName() { return G.w.hydType === "poteau" ? "le poteau d'incendie" : "la bouche d'incendie"; }
  function truckPts() { var w = G.w; return [w.portR, w.portA, w.portL, { x: w.truck.x, y: 60 }, { x: w.truck.x + w.truck.w, y: 60 }]; }
  function overview() { var w = G.w; focus([{ x: w.bx, y: w.by }, { x: w.bx + w.bw, y: w.fy }, { x: w.truck.x, y: 60 }, { x: w.truck.x + w.truck.w, y: 60 }, w.hyd], 5); }

  async function runLigne() {
    var w = G.w, me = role;
    var prep = "BAT, pour l'établissement d'une lance de 500 L/min à l'aide de tuyaux en couronnes, en reconnaissance !";
    setStep(0); overview();
    await say(prep, '<p class="hint">Ordre préparatoire : tu sais ce qu\'il faut emporter, pas encore où tu vas.</p>');
    setStep(1);
    var m = baseMat("BAT");
    if (me === "cbat") { m.lance = [1, 1]; m.t45 = [1, 1]; } else { m.t45 = [2, 2]; m.cmd = [1, 1]; }
    await materialStep(m, prep);
    setStep(2);
    show(speech("Chef d'agrès", "Suivez-moi.") + '<p class="msg hint">Reconnaissance avec le chef d\'agrès…</p>');
    focus([w.door, w.gate].concat(truckPts()), 6);
    await recon(w.attack, [["CB", "#c8321e"], ["EB", "#e0603a"]]);
    var exec = "BAT : feu au rez-de-chaussée. Mission : extinction. Point d'attaque : la porte d'entrée. Prise d'eau : le fourgon. Accès : par l'allée et le portillon. Vous pénétrez sur ordre. Établissez !";
    await say(exec, '<p class="hint">Ordre d\'exécution. Le point d\'attaque est la porte (cercle jaune).</p>', "Établir");
    clearFigs();
    setStep(3);
    var mine;
    if (me === "cbat") {
      mine = await throwSeq({ kind: "45", count: 1, start: w.attack, final: null, reserve: w.attack,
        label: "Tu es au point d'attaque, lance raccordée. Lance ta couronne vers le fourgon, puis fais ta réserve près de la porte." });
      var myEnd = endOf(mine[0], "B");
      var pts = autoCurve(myEnd, w.portR, 2 * CFG.TUYAU, "start");
      while (!pts) {
        toast("Ton équipier ne peut pas rejoindre le fourgon depuis le bout de ton tuyau.");
        record("Établissement", false, "Ton tuyau partait dans la mauvaise direction : ton équipier ne pouvait pas rejoindre le fourgon. Relance vers le portillon.");
        mine.forEach(removeHose); renderHoses();
        mine = await throwSeq({ kind: "45", count: 1, start: w.attack, final: null, reserve: w.attack, label: "Relance vers le portillon, puis fais ta réserve." });
        myEnd = endOf(mine[0], "B"); pts = autoCurve(myEnd, w.portR, 2 * CFG.TUYAU, "start");
      }
      mine.forEach(function (h) { h.dyn = false; });
      show(speech("Équipier BAT", "Je raccorde au bout de ton tuyau et j'établis jusqu'au refoulement.", "EB"));
      var auto = splitHoses(pts, "45", 2);
      await growHoses(auto, 1400);
      var ev = evaluate(mine, { reserve: w.attack });
      await showEval(ev);
      setStep(4);
      await choice("Tout est raccordé, vous êtes prêts à attaquer. Que dis-tu, et à qui ?",
        ["« Conducteur, de chef d'équipe BAT : ouvrez ! »", "« Établissez ! »", "« Échelle prête ! »", "« BAL, ouvrez la bouche ! »"], 0,
        "C'est toi, chef BAT, qui demandes l'eau au conducteur.", "Mise en eau");
    } else {
      var chefPts = (function () {
        var r = route(w.attack, w.portR), base = resample(r, 0.25), out = [], s = 0;
        for (var i = 0; i < base.length && s < 40; i++) { if (i) s += dist(base[i - 1], base[i]); out.push(base[i]); }
        var c = autoCurve(w.attack, out[out.length - 1], polyLen(out) + 7, "start");
        return c ? c.slice(0, Math.round(CFG.TUYAU / CFG.SEG) + 1) : resample(out, CFG.SEG).slice(0, 41);
      })();
      show(speech("Chef d'équipe BAT", "Lance raccordée, je lance ma couronne et je fais ma réserve. À toi !", "CB"));
      var chefHose = splitHoses(chefPts, "45", 1);
      await growHoses(chefHose, 800);
      var ce = endOf(chefHose[0], "B");
      mine = await throwSeq({ kind: "45", count: 2, start: { x: ce.x, y: ce.y, id: "chef" },
        final: { targets: [w.portR, w.portA, w.portL] }, reserve: null,
        label: "Raccorde-toi au bout du tuyau de ton chef et établis jusqu'au fourgon : 2 couronnes." });
      var last = mine[mine.length - 1];
      var okPort = last.pinB && last.pinB.id === "R";
      record("Raccordement", okPort, okPort ? "Raccordé au refoulement du fourgon." : "Tu t'es raccordé sur « " + (last.pinB ? last.pinB.label : "rien") + " » : une ligne d'attaque se branche sur un refoulement.");
      mine.forEach(function (h) { h.dyn = false; });
      await showEval(evaluate(mine, null));
      setStep(4);
      await choice("Ta ligne est raccordée au fourgon. Qui demande la mise en eau ?",
        ["Le chef d'équipe BAT, au conducteur", "Moi, l'équipier, dès que c'est raccordé", "Le conducteur, de lui-même", "Le chef BAL"], 0,
        "Le chef BAT, au contact du feu, commande l'eau : « Conducteur, de chef d'équipe BAT : ouvrez ! ».", "Mise en eau");
    }
  }

  async function runLDT() {
    var w = G.w;
    var prep = "BAT, pour l'établissement de la LDT, en reconnaissance !";
    setStep(0); overview();
    await say(prep, '<p class="hint">LDT : lance du dévidoir tournant, tuyaux semi-rigides toujours en eau.</p>');
    setStep(1);
    var m = baseMat("BAT"); m.lance = [1, 1];
    await materialStep(m, prep);
    setStep(2);
    show(speech("Chef d'agrès", "Suivez-moi.") + '<p class="msg hint">Reconnaissance…</p>');
    focus([w.door, w.gate].concat(truckPts()), 6);
    await recon(w.attack, [["CB", "#c8321e"], ["EB", "#e0603a"]]);
    await say("BAT : feu au rez-de-chaussée. Mission : extinction. Point d'attaque : la porte d'entrée. Prise d'eau : le fourgon, LDT. Accès : allée et portillon. Établissez !", "", "Établir");
    clearFigs();
    setStep(3);
    var r = await walkHose({ kind: "ldt", start: w.portL, max: CFG.LDT, targets: [w.attack], title: "Déroule la LDT jusqu'au point d'attaque",
      label: "Tu pars du dévidoir tournant à l'arrière du fourgon, lance à la main. Passe par le portillon." });
    r.hose.mine = true;
    await showEval(evaluate([r.hose], null));
    setStep(4);
    await choice("Au point d'attaque, avant d'engager l'action : que fais-tu avec le tuyau ?",
      ["Une réserve de 2 à 3 tours sur l'épaule", "Rien, je laisse le tuyau tendu derrière moi", "Une réserve de 10 tours au sol devant la porte", "Je demande au conducteur de dérouler plus"], 0,
      "Guide ETB-1 : le chef d'équipe fait une réserve sur l'épaule de deux à trois tours pour faciliter l'action.", "Réserve");
  }

  async function runDivision() {
    var w = G.w, me = role;
    var prep = "Pour l'établissement d'une LDV 500 sur division d'alimentation, avec le dévidoir mobile, en reconnaissance !";
    setStep(0); overview();
    await say(prep, '<p class="hint">Ordre préparatoire pour les deux binômes. Toi : ' + esc(ROLES[me].label) + ".</p>");
    setStep(1);
    var m = hydMat(baseMat("BAL", "div"), me);
    m.dev = [1, 1]; m.div = [0, 1];
    await materialStep(m, prep);
    setStep(2);
    show(speech("Chef d'agrès", "Suivez-moi.") + '<p class="msg hint">Reconnaissance avec les deux binômes…</p>');
    focus([w.door, w.hyd, w.gate].concat(truckPts()), 6);
    await recon(w.attack, [["CB", "#c8321e"], ["EB", "#e0603a"], ["CL", "#2f6fb3"], ["EL", "#4f8fd6"]]);
    var exec = "BAL : division d'alimentation au pied du bâtiment, près de la porte. Vous l'alimentez avec le dévidoir, puis vous alimentez l'engin sur " + hydName() + " " + sideOf(w.hyd) + ", avec le même dévidoir. Établissez !";
    await say(exec, "", "Établir");
    clearFigs();
    setStep(3);
    var spot = await clickTarget("Où poses-tu la division ?", "Clique sur le plan, à l'endroit où tu la poses.");
    var dd = dist(spot, w.door), okSpot = dd <= 8 && spot.y > w.fy + 0.3 && spot.y < w.fenceY - 0.5 && !(Math.abs(spot.x - w.door.x) < 1 && spot.y < w.fy + 1.5);
    var badWin = w.windows.some(function (x) { var dy = spot.y - w.fy; return dy > 0 && dy < 6 && Math.abs(spot.x - x) < 1.1 + dy * Math.tan(15 * Math.PI / 180); });
    record("Division", okSpot && !badWin, okSpot && !badWin ? "Division posée au pied du bâtiment, près de la porte." :
      !okSpot ? "La division se pose au pied du bâtiment, près du point d'attaque (ici à " + dd.toFixed(0) + " m de la porte)." : "Ta division est devant une fenêtre : déplace-la hors du cône des ouvrants.");
    var div = okSpot ? { x: spot.x, y: spot.y } : { x: w.door.x + (w.door.x > w.gate.x ? -3 : 3), y: w.fy + 3 };
    if (!okSpot) toast("Je la remets au pied du bâtiment pour la suite");
    var dg = el("g", {}); svg.insertBefore(dg, layers.hoses);
    el("path", { d: "M" + (div.x - 0.9) + " " + (div.y + 0.6) + " L" + div.x + " " + (div.y - 0.5) + " L" + (div.x + 0.9) + " " + (div.y + 0.6), fill: "none", stroke: "#c99a2e", "stroke-width": 0.45, "stroke-linecap": "round" }, dg);
    el("circle", { cx: div.x, cy: div.y + 0.2, r: 0.55, fill: "#e0b64e", stroke: "#7a5f22", "stroke-width": 0.12 }, dg);
    txt(dg, "division", div.x, div.y - 1, 0.9, { fill: "#fff", stroke: "#333", sw: 0.3 });
    focus([div, w.hyd, w.gate].concat(truckPts()), 5);
    var w1 = await walkHose({ kind: "dev", start: { x: div.x, y: div.y + 0.4, id: "div" }, max: CFG.DEVIDOIR, targets: [w.portR, w.portA],
      title: "Dévidoir : de la division au fourgon", label: "Le binôme part de la division avec le dévidoir et déroule vers le fourgon. Relâche sur la sortie où tu donnes le raccord." });
    var ok1 = w1.target.id === "R";
    record("Raccordement", ok1, ok1 ? "Ligne de la division donnée au refoulement." : "La ligne qui alimente la division se donne en REFOULEMENT (tu l'as mise sur « " + w1.target.label + " »).");
    var used = (w1.hose.n.length - 1);
    var other = await clickTarget("Avec le même dévidoir : où donnes-tu l'autre raccord au fourgon ?", "Clique sur la sortie.", [w.portR, w.portA]);
    var ok2 = other.id === "A";
    record("Raccordement", ok2, ok2 ? "Second raccord donné en alimentation." : "L'autre raccord (côté prise d'eau) se donne en ALIMENTATION.");
    var w2 = await walkHose({ kind: "dev", start: other, max: Math.max(10, CFG.DEVIDOIR - used), targets: [w.hyd],
      title: "Repars vers la prise d'eau", label: "Toujours avec le même dévidoir, va jusqu'à " + hydName() + " et relâche dessus pour te raccorder." });
    var c = G.counts || {};
    if (w.hydType === "bouche") record("Prise d'eau", !!(c.ret || me === "ebal"), (c.ret || me === "ebal") ? "Retenue posée sur la bouche, raccordée." : "Pas de retenue : impossible de se brancher sur une bouche.");
    var bpts = autoCurve({ x: div.x + 0.6, y: div.y }, w.attack, Math.max(dist(div, w.attack) + 3, 6), "end");
    if (bpts) { show(speech("Chef d'équipe BAT", "On se branche sur la division et on monte.", "CB")); await growHoses([newHose("45", CFG.SEG, bpts, false)], 600); }
    await showEval(evaluate([w1.hose, w2.hose], null));
    setStep(4);
    await choice("La division et l'alimentation sont établies. Que fais-tu ?",
      ["Je rends compte au chef d'agrès", "J'attends au fourgon sans rien dire", "Je pars aider le BAT sans ordre", "J'ouvre la lance du BAT"], 0,
      "Après une action, le binôme rend compte au chef d'agrès ; il peut recevoir une nouvelle mission (guide §6).", "Fin de mission");
  }

  async function runAlimC() {
    var w = G.w, me = role;
    var prep = "BAL, pour l'alimentation de l'engin sur " + hydName() + ", à l'aide de tuyaux en couronnes, en reconnaissance !";
    setStep(0); overview();
    await say(prep, "");
    setStep(1);
    var m = hydMat(baseMat("BAL"), me);
    if (me === "cbal") m.t70 = [1, 1]; else m.t70 = [2, 2];
    await materialStep(m, prep);
    setStep(2);
    show(speech("Chef d'agrès", "La prise d'eau est là.") + '<p class="msg hint">Reconnaissance de la prise d\'eau…</p>');
    focus([w.hyd].concat(truckPts()), 7);
    await recon({ x: w.hyd.x, y: w.hyd.y - 1.5 }, [["CL", "#2f6fb3"], ["EL", "#4f8fd6"]]);
    await say("BAL : alimentez l'engin sur " + hydName() + " " + sideOf(w.hyd) + ", tuyaux en couronnes, le long du trottoir. Établissez !", "", "Établir");
    clearFigs();
    setStep(3);
    var mine;
    if (me === "cbal") {
      if (w.hydType === "bouche") toast("Tu poses la retenue sur la bouche et tu raccordes");
      mine = await throwSeq({ kind: "70", count: 1, start: w.hyd, final: null, reserve: null,
        label: "Tu es à la prise d'eau. Lance ta couronne de 70 vers le fourgon, le long du trottoir." });
      var e = endOf(mine[0], "B"), pts = autoCurve(e, w.portA, 2 * CFG.TUYAU, "end");
      while (!pts) {
        record("Établissement", false, "Ton tuyau partait dans la mauvaise direction : ton équipier ne pouvait pas rejoindre le fourgon.");
        toast("Ton équipier ne peut pas rejoindre le fourgon : relance");
        mine.forEach(removeHose); renderHoses();
        mine = await throwSeq({ kind: "70", count: 1, start: w.hyd, final: null, reserve: null, label: "Relance vers le fourgon." });
        e = endOf(mine[0], "B"); pts = autoCurve(e, w.portA, 2 * CFG.TUYAU, "end");
      }
      mine.forEach(function (h) { h.dyn = false; });
      show(speech("Équipier BAL", "Je raccorde et j'établis jusqu'à l'alimentation du fourgon.", "EL"));
      await growHoses(splitHoses(pts, "70", 2), 1300);
    } else {
      var r = resample(route(w.hyd, w.portA), CFG.SEG).slice(0, Math.round(CFG.TUYAU / CFG.SEG) + 1);
      show(speech("Chef d'équipe BAL", "Je suis branché à la prise d'eau, ma couronne est lancée. À toi !", "CL"));
      var ch = splitHoses(r, "70", 1);
      await growHoses(ch, 700);
      var ce = endOf(ch[0], "B");
      mine = await throwSeq({ kind: "70", count: 2, start: { x: ce.x, y: ce.y, id: "chef" }, final: { targets: [w.portR, w.portA] }, reserve: null,
        label: "Raccorde-toi au bout du tuyau de ton chef, établis tes 2 tuyaux de 70 et raccorde-toi au fourgon." });
      var last = mine[mine.length - 1], ok = last.pinB && last.pinB.id === "A";
      record("Raccordement", ok, ok ? "Raccordé à l'alimentation du fourgon." : "L'alimentation de l'engin se branche sur l'entrée ALIMENTATION, pas sur « " + (last.pinB ? last.pinB.label : "rien") + " ».");
      mine.forEach(function (h) { h.dyn = false; });
    }
    await showEval(evaluate(mine, null));
    setStep(4);
    await choice("L'engin est alimenté. Que fais-tu ?",
      ["Je rends compte au chef d'agrès", "J'attends au fourgon sans rien dire", "Je pars aider le BAT sans ordre", "Je ferme la prise d'eau pour économiser"], 0,
      "Après une action, le binôme rend compte au chef d'agrès ; il peut recevoir une nouvelle mission (guide §6).", "Fin de mission");
  }

  async function runAlimD() {
    var w = G.w, me = role;
    var prep = "BAL, pour l'alimentation de l'engin sur " + hydName() + ", avec le dévidoir mobile, en reconnaissance !";
    setStep(0); overview();
    await say(prep, "");
    setStep(1);
    var m = hydMat(baseMat("BAL"), me); m.dev = [1, 1];
    await materialStep(m, prep);
    setStep(2);
    show(speech("Chef d'agrès", "La prise d'eau est loin, là-bas.") + '<p class="msg hint">Reconnaissance…</p>');
    focus([w.hyd].concat(truckPts()), 6);
    await recon({ x: w.hyd.x, y: w.hyd.y - 1.5 }, [["CL", "#2f6fb3"], ["EL", "#4f8fd6"]]);
    await say("BAL : alimentez l'engin sur " + hydName() + " " + sideOf(w.hyd) + ", à " + Math.round(dist(w.hyd, w.portA)) + " m, avec le dévidoir mobile. Établissez !", "", "Établir");
    clearFigs();
    setStep(3);
    var port = await clickTarget("Où branches-tu le dévidoir au fourgon ?", "Clique sur la sortie.", [w.portR, w.portA]);
    record("Raccordement", port.id === "A", port.id === "A" ? "Dévidoir branché sur l'alimentation." : "Pour alimenter l'engin, le dévidoir se branche sur l'entrée ALIMENTATION.");
    var r = await walkHose({ kind: "dev", start: port, max: CFG.DEVIDOIR, targets: [w.hyd], title: "Déroule le dévidoir jusqu'à la prise d'eau",
      label: "Avance avec le dévidoir le long du trottoir, relâche sur la prise d'eau pour raccorder." });
    var c = G.counts || {};
    if (w.hydType === "bouche") record("Prise d'eau", !!(c.ret || me === "ebal"), (c.ret || me === "ebal") ? "Retenue posée sur la bouche, raccordée." : "Pas de retenue : impossible de se brancher sur une bouche.");
    await showEval(evaluate([r.hose], null));
    setStep(4);
    await choice("L'engin est alimenté. Que fais-tu ?",
      ["Je rends compte au chef d'agrès", "J'attends au fourgon sans rien dire", "Je pars aider le BAT sans ordre", "Je reste à la prise d'eau sans prévenir"], 0,
      "Après une action, le binôme rend compte au chef d'agrès (guide §6).", "Fin de mission");
  }

  async function showEval(list) {
    list.forEach(function (r) { record(r.cat, r.ok, r.msg); });
    flagProblems(list);
    show('<div class="who">Vérification de la pose</div><ul class="res">' + list.map(function (r) {
      return '<li class="' + (r.ok ? "ok" : "ko") + '"><span class="cat">' + esc(r.cat) + "</span>" + esc(r.msg) + "</li>";
    }).join("") + '</ul><div class="controls"><button class="primary" id="okb">Continuer</button></div>');
    await waitClick("okb");
    layers.marks.innerHTML = "";
  }

  // ===================== Partie =====================
  function chooseRole() {
    setStep(-1);
    document.getElementById("roleTag").textContent = "Choisis ton rôle";
    show('<div class="who">Nouvelle manœuvre</div><div class="quote">Quel est ton rôle ?</div>' +
      '<p class="hint">Tu ne fais que ta part ; les autres font la leur. La consigne et la position du fourgon changent à chaque fois.</p><div class="roles">' +
      Object.keys(ROLES).map(function (k) { return '<button data-r="' + k + '"><b>' + ROLES[k].short + "</b><span>" + ROLES[k].desc + "</span></button>"; }).join("") +
      '</div><div class="controls"><button class="primary" data-r="hasard">Au hasard</button></div>');
    panel.onclick = function (e) {
      var b = e.target.closest("button[data-r]"); if (!b) return;
      panel.onclick = null;
      var r = b.dataset.r === "hasard" ? pick(Object.keys(ROLES)) : b.dataset.r;
      play(r);
    };
  }
  async function play(r, forced) {
    role = r;
    var kinds = Object.keys(SCENARIOS).filter(function (k) { return SCENARIOS[k].roles.indexOf(r) >= 0; });
    var kind = forced || pick(kinds);
    G = { kind: kind, w: null, hoses: [], results: [], counts: {} };
    G.w = genWorld(kind);
    drawWorld();
    focus([{ x: 0, y: 0 }, { x: 120, y: 75 }], 0, true);
    document.getElementById("roleTag").textContent = ROLES[r].label + " · " + SCENARIOS[kind].title;
    var run = { ligne: runLigne, ldt: runLDT, division: runDivision, alimC: runAlimC, alimD: runAlimD }[kind];
    await run();
    bilan();
  }
  function bilan() {
    setStep(5);
    setMode("none");
    var res = G.results, ok = res.filter(function (x) { return x.ok; }).length;
    var pct = res.length ? Math.round(100 * ok / res.length) : 0;
    show('<div class="who">Bilan · ' + esc(SCENARIOS[G.kind].title) + '</div><div class="score">' + ok + " / " + res.length + "</div>" +
      '<p class="hint">' + (pct === 100 ? "Manœuvre propre, rien à redire." : pct >= 70 ? "Bien, quelques points à reprendre." : "À retravailler : relis les points en rouge.") + "</p>" +
      '<ul class="res">' + res.map(function (r) { return '<li class="' + (r.ok ? "ok" : "ko") + '"><span class="cat">' + esc(r.cat) + "</span>" + esc(r.msg) + "</li>"; }).join("") +
      '</ul><div class="controls"><button class="primary" id="again">Rejouer ce rôle</button><button id="change">Changer de rôle</button></div>');
    try {
      var k = "placement-stats-v1", s = JSON.parse(localStorage.getItem(k) || "{}");
      s[role] = s[role] || { n: 0, ok: 0 }; s[role].n++; if (pct === 100) s[role].ok++;
      localStorage.setItem(k, JSON.stringify(s));
    } catch (e) {}
    document.getElementById("again").onclick = function () { play(role); };
    document.getElementById("change").onclick = chooseRole;
  }

  // Écran d'accueil : plan d'exemple + choix du rôle
  G = { kind: "ligne", w: genWorld("ligne"), hoses: [], results: [] };
  drawWorld();
  focus([{ x: 0, y: 0 }, { x: 120, y: 75 }], 0, true);
  chooseRole();
  window.__placement = { get G() { return G; }, get cam() { return cam; }, get mode() { return mode; }, CFG: CFG, play: play };
})();
