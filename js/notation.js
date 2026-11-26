/*
 * notation.js — music notation as SVG, using the Leland music font.
 *
 * Symbols (clefs, noteheads, flags, rests, accidentals, dynamics, articulations)
 * are characters from "SayItOnBeat Music", a trimmed copy of Leland built by
 * tools/build_font.py into css/music-font.css. Staff lines, stems, beams, ledger
 * lines, barlines and slurs are drawn as lines and shapes.
 *
 * Units: one staff space = 10. A five-line staff whose top line is at `top` has
 * lines at top, top+10, ... top+40. Leland follows SMuFL: the font size is four
 * staff spaces (40), and every metric below is in staff spaces from
 * vendor/leland/leland_metadata.json.
 */
(function (global) {
  'use strict';

  const SP = 10;           // staff space
  const HALF = SP / 2;     // one diatonic step
  const FONT_SIZE = 4 * SP;
  const INK = '#111';
  const FAMILY = 'SayItOnBeat Music';

  // Line thicknesses from Leland's engravingDefaults (staff spaces).
  const ENGRAVING = {
    staffLine: 0.11, stem: 0.1, legerLine: 0.16, legerExtension: 0.33,
    beam: 0.5, beamSpacing: 0.25, thinBarline: 0.18, thickBarline: 0.55,
    barlineSeparation: 0.37, repeatDotSeparation: 0.37
  };

  // SMuFL code point and advance width (staff spaces) of every symbol used.
  // Keep in sync with CODEPOINTS in tools/build_font.py.
  const GLYPHS = {
    gClef: [0xE050, 2.56], cClef: [0xE05C, 2.508], fClef: [0xE062, 2.652],
    noteheadWhole: [0xE0A2, 1.492], noteheadHalf: [0xE0A3, 1.3], noteheadBlack: [0xE0A4, 1.3],
    augmentationDot: [0xE1E7, 0.4],
    flag8thUp: [0xE240, 1.156], flag8thDown: [0xE241, 1.236], flag16thUp: [0xE242, 1.12], flag16thDown: [0xE243, 1.236],
    accidentalFlat: [0xE260, 0.848], accidentalNatural: [0xE261, 0.684], accidentalSharp: [0xE262, 0.976],
    accidentalDoubleSharp: [0xE263, 1.1], accidentalDoubleFlat: [0xE264, 1.484],
    restWhole: [0xE4E3, 1.3], restHalf: [0xE4E4, 1.3], restQuarter: [0xE4E5, 0.94], rest8th: [0xE4E6, 1.104],
    articAccentAbove: [0xE4A0, 1.44], articStaccatoAbove: [0xE4A2, 0.312], articTenutoAbove: [0xE4A4, 1.264],
    fermataAbove: [0xE4C0, 2.488],
    segno: [0xE047, 2.616], coda: [0xE048, 2.98],
    timeSig0: [0xE080, 1.616], timeSig1: [0xE081, 1.404], timeSig2: [0xE082, 1.568], timeSig3: [0xE083, 1.516],
    timeSig4: [0xE084, 1.828], timeSig5: [0xE085, 1.508], timeSig6: [0xE086, 1.608], timeSig7: [0xE087, 1.524],
    timeSig8: [0xE088, 1.632], timeSig9: [0xE089, 1.608],
    noteheadXBlack: [0xE0A9, 1.3],
    articMarcatoAbove: [0xE4AC, 1.18], articStaccatissimoWedgeAbove: [0xE4A8, 0.488],
    articAccentStaccatoAbove: [0xE4B0, 1.44], articTenutoStaccatoAbove: [0xE4B2, 1.264], articTenutoAccentAbove: [0xE4B4, 1.44],
    fermataShortAbove: [0xE4C4, 2.568], fermataLongAbove: [0xE4C6, 2.492], caesura: [0xE4D1, 1.52],
    pluckedSnapPizzicatoAbove: [0xE631, 1.076], pluckedBuzzPizzicato: [0xE632, 1.556], stringsHarmonic: [0xE614, 0.724],
    tremolo3: [0xE222, 0.58],
    accidentalQuarterToneSharpStein: [0xE282, 0.72], accidentalNarrowReversedFlat: [0xE284, 0.64],
    dynamicSforzandoPiano: [0xE537, 3.256],
    tuplet3: [0xE883, 1.116], tuplet2: [0xE882, 1.188], tuplet5: [0xE885, 1.18], tuplet6: [0xE886, 1.116], tuplet7: [0xE887, 1.088],
    ornamentTrill: [0xE566, 1.732], wiggleTrill: [0xEAA4, 0.88], ornamentMordent: [0xE56D, 1.892], ornamentShortTrill: [0xE56C, 1.892], ornamentTurn: [0xE567, 1.824], ornamentTurnInverted: [0xE568, 1.824], ornamentTurnSlash: [0xE569, 1.824], ornamentTremblement: [0xE56E, 2.616], ornamentSchleifer: [0xE587, 2.364], ornamentPrecompTrillWithMordent: [0xE5BD, 2.612], repeat1Bar: [0xE500, 1.924], breathMarkComma: [0xE4CE, 0.764], fermataVeryLongAbove: [0xE4C8, 3.368], noteheadDiamondHalf: [0xE0D9, 1.34],
    timeSigCommon: [0xE08A, 1.852], timeSigCutCommon: [0xE08B, 1.852],
    dynamicPiano: [0xE520, 1.268], dynamicMezzo: [0xE521, 1.496], dynamicForte: [0xE522, 1.336],
    dynamicSforzando: [0xE524, 0.832], dynamicZ: [0xE525, 0.956],
    dynamicPP: [0xE52B, 2.564], dynamicMP: [0xE52C, 2.784], dynamicMF: [0xE52D, 2.832], dynamicFF: [0xE52F, 2.352],
    dynamicFortePiano: [0xE534, 2.324], dynamicSforzato: [0xE539, 2.792],
    stringsDownBow: [0xE610, 1.26], stringsUpBow: [0xE612, 1.048]
  };

  // Stem attachment points on the noteheads (staff spaces, y up).
  const STEM_ANCHORS = {
    noteheadBlack: { up: [1.3, 0.16], down: [0, -0.168] },
    noteheadHalf: { up: [1.3, 0.16], down: [0, -0.168] },
    noteheadXBlack: { up: [1.3, 0.424], down: [0, -0.424] },
    noteheadDiamondHalf: { up: [1.34, 0], down: [0, 0] }
  };

  const r = (n) => Math.round(n * 100) / 100;
  const width = (name, size) => GLYPHS[name][1] * SP * ((size || FONT_SIZE) / FONT_SIZE);

  function svg(viewBox, body, extraClass) {
    return '<svg class="notation' + (extraClass ? ' ' + extraClass : '') +
      '" viewBox="' + viewBox + '" xmlns="http://www.w3.org/2000/svg"' +
      ' preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<g fill="' + INK + '" stroke="none">' + body + '</g></svg>';
  }

  /*
   * One font symbol with its origin (left edge, baseline) at (x, y).
   * opts: { size, anchor: 'start' | 'middle' }
   */
  function glyph(name, x, y, opts) {
    opts = opts || {};
    const size = opts.size || FONT_SIZE;
    const chars = (Array.isArray(name) ? name : [name])
      .map((n) => '&#x' + GLYPHS[n][0].toString(16).toUpperCase() + ';').join('');
    return '<text x="' + r(x) + '" y="' + r(y) + '" font-family="' + FAMILY + '" font-size="' + r(size) + '"' +
      ' font-style="normal" font-weight="normal"' +
      (opts.anchor ? ' text-anchor="' + opts.anchor + '"' : '') + '>' + chars + '</text>';
  }

  /* ---------- pitch helpers ---------- */

  const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  // Diatonic number of the bottom staff line for each clef.
  const BOTTOM_LINE = { treble: 4 * 7 + 2 /* E4 */, bass: 2 * 7 + 4 /* G2 */,
    alto: 3 * 7 + 3 /* F3 */, tenor: 3 * 7 + 1 /* D3 */ };

  function diatonic(step, octave) { return octave * 7 + STEPS.indexOf(step); }

  // Staff position: 0 = bottom line, 1 = first space, 8 = top line.
  function staffPos(step, octave, clef) {
    return diatonic(step, octave) - BOTTOM_LINE[clef || 'treble'];
  }

  function posToY(pos, top) { return top + 4 * SP - pos * HALF; }

  /* ---------- basic shapes ---------- */

  function rect(x, y, w, h) {
    return '<rect x="' + r(x) + '" y="' + r(y) + '" width="' + r(w) + '" height="' + r(h) + '"/>';
  }
  function line(x1, y1, x2, y2, w) {
    return '<line x1="' + r(x1) + '" y1="' + r(y1) + '" x2="' + r(x2) + '" y2="' + r(y2) +
      '" stroke="' + INK + '" stroke-width="' + (w || 1.2) + '" stroke-linecap="butt"/>';
  }
  function circle(cx, cy, rad) {
    return '<circle cx="' + r(cx) + '" cy="' + r(cy) + '" r="' + r(rad) + '"/>';
  }
  function strokePath(d, w, cap) {
    return '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (w || 1.6) +
      '" stroke-linecap="' + (cap || 'round') + '" stroke-linejoin="round"/>';
  }
  function fillPath(d) { return '<path d="' + d + '"/>'; }
  function g(transform, body) { return '<g transform="' + transform + '">' + body + '</g>'; }

  // Words such as "pizz." and "D.C. al Fine" are set in an ordinary serif font.
  function text(x, y, str, size, opts) {
    opts = opts || {};
    return '<text x="' + r(x) + '" y="' + r(y) + '" font-size="' + size + '"' +
      ' font-family="' + (opts.family || "'Times New Roman', Times, Georgia, serif") + '"' +
      ' font-style="' + (opts.italic === false ? 'normal' : 'italic') + '"' +
      ' font-weight="' + (opts.weight || 'bold') + '"' +
      ' text-anchor="' + (opts.anchor || 'middle') + '"' +
      '>' + str + '</text>';
  }

  /* ---------- staff ---------- */

  function staff(x1, x2, top, lines) {
    let s = '';
    const n = lines || 5;
    for (let i = 0; i < n; i++) s += line(x1, top + i * SP, x2, top + i * SP, ENGRAVING.staffLine * SP);
    return s;
  }

  function singleLine(x1, x2, y) { return line(x1, y, x2, y, 1.3); }

  function barline(x, top, bottom, w) { return line(x, top, x, bottom, w || ENGRAVING.thinBarline * SP); }

  // Ledger lines for a note centred at x at staff position `pos`.
  function ledgers(x, pos, top) {
    let s = '';
    const w = width('noteheadBlack') / 2 + ENGRAVING.legerExtension * SP;
    const t = ENGRAVING.legerLine * SP;
    for (let p = -2; p >= pos; p -= 2) s += line(x - w, posToY(p, top), x + w, posToY(p, top), t);
    for (let p = 10; p <= pos; p += 2) s += line(x - w, posToY(p, top), x + w, posToY(p, top), t);
    return s;
  }

  /* ---------- clefs ---------- */

  // Each clef's origin sits on the line it names: G (2nd line), F (4th), C (middle or 4th).
  const CLEF_LINE = { treble: ['gClef', 30], bass: ['fClef', 10], alto: ['cClef', 20], tenor: ['cClef', 10] };

  function clef(type, x, top) {
    const c = CLEF_LINE[type];
    return c ? glyph(c[0], x, top + c[1]) : '';
  }
  function clefWidth(type) { return width(CLEF_LINE[type][0]); }

  /* ---------- accidentals (left edge at x, centred on the note's line or space) ---------- */

  const ACCIDENTAL = { '#': 'accidentalSharp', b: 'accidentalFlat', n: 'accidentalNatural', x: 'accidentalDoubleSharp', bb: 'accidentalDoubleFlat',
    qs: 'accidentalQuarterToneSharpStein', qf: 'accidentalNarrowReversedFlat' };

  function accidental(acc, x, y, size) {
    return ACCIDENTAL[acc] ? glyph(ACCIDENTAL[acc], x, y, { size: size }) : '';
  }
  function accidentalWidth(acc, size) { return ACCIDENTAL[acc] ? width(ACCIDENTAL[acc], size) : 0; }

  /* ---------- notes ---------- */

  const HEAD = { w: 'noteheadWhole', h: 'noteheadHalf' };
  const FLAGS = { '8': ['flag8thUp', 'flag8thDown'], '16': ['flag16thUp', 'flag16thDown'] };

  // A notehead centred on x.
  function notehead(x, y, kind) {
    const name = kind === 'whole' ? 'noteheadWhole' : kind === 'half' ? 'noteheadHalf' : 'noteheadBlack';
    return glyph(name, x - width(name) / 2, y);
  }

  /*
   * A single note centred on x. opts: { dur: 'w'|'h'|'q'|'8'|'16', up: bool, dots: n,
   *   stemLen, noFlag: bool (for beamed notes), dotUp: bool (note on a line), head: notehead glyph }
   * Returns { svg, stemX, stemEnd } where stemX is the centre of the stem.
   */
  function note(x, y, opts) {
    const dur = opts.dur;
    const up = opts.up !== false;
    const headName = opts.head || HEAD[dur] || 'noteheadBlack';
    const anchors = STEM_ANCHORS[headName] || STEM_ANCHORS.noteheadBlack;
    const left = x - width(headName) / 2;
    let s = glyph(headName, left, y);
    let stemX = null, stemEnd = null;
    if (dur !== 'w') {
      const stemW = ENGRAVING.stem * SP * 1.3;
      const len = (opts.stemLen || 35) + (dur === '16' && !opts.noFlag ? 3 : 0);
      if (up) {
        stemX = left + anchors.up[0] * SP - stemW / 2;
        stemEnd = y - len;
        s += line(stemX, y - anchors.up[1] * SP, stemX, stemEnd, stemW);
      } else {
        stemX = left + anchors.down[0] * SP + stemW / 2;
        stemEnd = y + len;
        s += line(stemX, y - anchors.down[1] * SP, stemX, stemEnd, stemW);
      }
      if (!opts.noFlag && FLAGS[dur]) s += glyph(FLAGS[dur][up ? 0 : 1], stemX - stemW / 2, stemEnd);
    }
    const right = left + width(headName);
    for (let i = 0; i < (opts.dots || 0); i++) {
      s += glyph('augmentationDot', right + 3 + i * 6, y - (opts.dotUp ? HALF : 0));
    }
    return { svg: s, stemX: stemX, stemEnd: stemEnd };
  }

  // A horizontal beam joining stems (all stems up, beam top at yTop).
  function beam(x1, x2, yTop, level) {
    const t = ENGRAVING.beam * SP;
    const y = yTop + (level || 0) * (t + ENGRAVING.beamSpacing * SP);
    const half = ENGRAVING.stem * SP * 0.65;
    return rect(x1 - half, y, x2 - x1 + 2 * half, t);
  }

  /* ---------- rests, centred on x; `mid` is the staff's middle line ---------- */

  const REST = { w: 'restWhole', h: 'restHalf', q: 'restQuarter', '8': 'rest8th' };

  function rest(kind, x, mid, dots) {
    const name = REST[kind];
    if (!name) return '';
    // The whole rest hangs from the line above the middle; the others sit on the middle line.
    let s = glyph(name, x - width(name) / 2, kind === 'w' ? mid - SP : mid);
    if (dots) s += glyph('augmentationDot', x + width(name) / 2 + 3, mid - HALF);
    return s;
  }

  /* ---------- articulations and other symbols ---------- */

  // "Above" symbols have their baseline at the bottom; these centre them on cx.
  function above(name, cx, baseY, size) { return glyph(name, cx - width(name, size) / 2, baseY, { size: size }); }

  function downBow(cx, baseY) { return above('stringsDownBow', cx, baseY); }
  function upBow(cx, baseY) { return above('stringsUpBow', cx, baseY); }
  function staccato(cx, baseY) { return above('articStaccatoAbove', cx, baseY); }
  function accent(cx, baseY) { return above('articAccentAbove', cx, baseY); }
  function tenuto(cx, baseY) { return above('articTenutoAbove', cx, baseY); }
  function fermata(cx, baseY) { return above('fermataAbove', cx, baseY); }
  function coda(cx, baseY, size) { return above('coda', cx, baseY, size); }
  function tuplet3(cx, baseY) { return above('tuplet3', cx, baseY); }
  // A tuplet number (2, 3, 5, 6, 7) centred on cx.
  function tupletNum(n, cx, baseY) { return above('tuplet' + n, cx, baseY); }
  // Tremolo slashes centred on (cx, cy), usually across a stem.
  function tremolo(cx, cy) { return glyph('tremolo3', cx, cy); }

  // A time-signature number (one or two digits), centred on cx and on the line at cy.
  function timeSigNumber(n, cx, cy, size) {
    const names = String(n).split('').map((d) => 'timeSig' + d);
    return glyph(names, cx, cy, { size: size, anchor: 'middle' });
  }
  function timeSigNumberWidth(n) {
    return String(n).split('').reduce((w, d) => w + width('timeSig' + d), 0);
  }
  // A whole time signature: the top number above the middle line, the bottom number below.
  function timeSig(top, bottom, cx, mid) { return timeSigNumber(top, cx, mid - SP) + timeSigNumber(bottom, cx, mid + SP); }
  // Common time (C) and cut time (¢), centred on cx and the middle line.
  function timeSigSymbol(kind, cx, mid) {
    return glyph(kind === 'cut' ? 'timeSigCutCommon' : 'timeSigCommon', cx, mid, { anchor: 'middle' });
  }

  // Dynamics, using Leland's ready-made combinations.
  const DYNAMICS = {
    pp: 'dynamicPP', p: 'dynamicPiano', mp: 'dynamicMP', mf: 'dynamicMF', f: 'dynamicForte',
    ff: 'dynamicFF', fp: 'dynamicFortePiano', sfz: 'dynamicSforzato', sfp: 'dynamicSforzandoPiano'
  };
  function dynamic(str, cx, baseY, size) {
    return glyph(DYNAMICS[str], cx, baseY, { size: size, anchor: 'middle' });
  }

  // A slur or tie between two points; bulges downward if `down`.
  function curve(x1, y1, x2, y2, down, height) {
    const h = (height || 7) * (down ? 1 : -1);
    const mx1 = x1 + (x2 - x1) * 0.25, mx2 = x1 + (x2 - x1) * 0.75;
    return fillPath('M' + r(x1) + ',' + r(y1) + ' C' + r(mx1) + ',' + r(y1 + h) + ' ' + r(mx2) + ',' + r(y2 + h) + ' ' + r(x2) + ',' + r(y2) +
      ' C' + r(mx2) + ',' + r(y2 + h * 0.75) + ' ' + r(mx1) + ',' + r(y1 + h * 0.75) + ' ' + r(x1) + ',' + r(y1) + 'Z');
  }
  function hairpin(x1, x2, y, opening) {
    const h = 7;
    return opening
      ? strokePath('M' + r(x2) + ',' + r(y - h) + ' L' + r(x1) + ',' + r(y) + ' L' + r(x2) + ',' + r(y + h), 1.8, 'butt')
      : strokePath('M' + r(x1) + ',' + r(y - h) + ' L' + r(x2) + ',' + r(y) + ' L' + r(x1) + ',' + r(y + h), 1.8, 'butt');
  }

  /* ---------- barlines ---------- */

  const THIN = ENGRAVING.thinBarline * SP, THICK = ENGRAVING.thickBarline * SP;
  const GAP = ENGRAVING.barlineSeparation * SP, DOT_GAP = ENGRAVING.repeatDotSeparation * SP;
  const DOT_R = 2;

  function repeatDots(x, top) { return circle(x, top + 15, DOT_R) + circle(x, top + 25, DOT_R); }
  function endRepeat(x, top) {   // x = right edge
    const thinX = x - THICK - GAP - THIN / 2;
    return repeatDots(thinX - THIN / 2 - DOT_GAP - DOT_R, top) + line(thinX, top, thinX, top + 40, THIN) + rect(x - THICK, top, THICK, 40);
  }
  function startRepeat(x, top) { // x = left edge
    const thinX = x + THICK + GAP + THIN / 2;
    return rect(x, top, THICK, 40) + line(thinX, top, thinX, top + 40, THIN) + repeatDots(thinX + THIN / 2 + DOT_GAP + DOT_R, top);
  }
  // End-and-start repeat (:||:) with its thick line centred on x.
  function doubleRepeat(x, top) {
    const thinL = x - THICK / 2 - GAP - THIN / 2, thinR = x + THICK / 2 + GAP + THIN / 2;
    return repeatDots(thinL - THIN / 2 - DOT_GAP - DOT_R, top) + line(thinL, top, thinL, top + 40, THIN) +
      rect(x - THICK / 2, top, THICK, 40) + line(thinR, top, thinR, top + 40, THIN) + repeatDots(thinR + THIN / 2 + DOT_GAP + DOT_R, top);
  }
  function finalBarline(x, top) {
    const thinX = x - THICK - GAP - THIN / 2;
    return line(thinX, top, thinX, top + 40, THIN) + rect(x - THICK, top, THICK, 40);
  }

  global.Notation = {
    SP: SP, HALF: HALF, svg: svg, g: g, rect: rect, line: line, circle: circle, text: text, glyph: glyph, width: width,
    staff: staff, singleLine: singleLine, barline: barline, ledgers: ledgers,
    clef: clef, clefWidth: clefWidth, accidental: accidental, accidentalWidth: accidentalWidth,
    note: note, notehead: notehead, beam: beam, rest: rest,
    staffPos: staffPos, posToY: posToY, diatonic: diatonic,
    downBow: downBow, upBow: upBow, staccato: staccato, accent: accent, tenuto: tenuto,
    fermata: fermata, coda: coda, tuplet3: tuplet3, tupletNum: tupletNum, timeSigSymbol: timeSigSymbol, tremolo: tremolo, above: above,
    timeSig: timeSig, timeSigNumber: timeSigNumber, timeSigNumberWidth: timeSigNumberWidth, dynamic: dynamic,
    curve: curve, hairpin: hairpin,
    endRepeat: endRepeat, startRepeat: startRepeat, finalBarline: finalBarline, doubleRepeat: doubleRepeat,
    strokePath: strokePath, fillPath: fillPath
  };
})(window);
