/*
 * notation.js — tiny hand-drawn SVG music notation.
 *
 * Everything is drawn with plain SVG paths so the app works offline and
 * looks the same on every classroom computer (no music fonts needed).
 *
 * Units: one staff space = 10. A five-line staff whose top line is at
 * `top` has lines at top, top+10, ... top+40.
 */
(function (global) {
  'use strict';

  const SP = 10;           // staff space
  const HALF = SP / 2;     // one diatonic step
  const INK = '#111';

  const r = (n) => Math.round(n * 100) / 100;

  function svg(viewBox, body, extraClass) {
    return '<svg class="notation' + (extraClass ? ' ' + extraClass : '') +
      '" viewBox="' + viewBox + '" xmlns="http://www.w3.org/2000/svg"' +
      ' preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<g fill="' + INK + '" stroke="none">' + body + '</g></svg>';
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
  function text(x, y, str, size, opts) {
    opts = opts || {};
    return '<text x="' + r(x) + '" y="' + r(y) + '" font-size="' + size + '"' +
      ' font-family="' + (opts.family || "'Times New Roman', Times, Georgia, serif") + '"' +
      ' font-style="' + (opts.italic === false ? 'normal' : 'italic') + '"' +
      ' font-weight="' + (opts.weight || 'bold') + '"' +
      ' text-anchor="' + (opts.anchor || 'middle') + '"' +
      (opts.spacing ? ' letter-spacing="' + opts.spacing + '"' : '') +
      '>' + str + '</text>';
  }

  // An ellipse as a path, so two of them can make a hollow note head.
  function ellipsePath(rx, ry) {
    return 'M' + (-rx) + ',0a' + rx + ',' + ry + ' 0 1,0 ' + (2 * rx) + ',0a' + rx + ',' + ry +
      ' 0 1,0 ' + (-2 * rx) + ',0Z';
  }

  /* ---------- staff ---------- */

  function staff(x1, x2, top, lines) {
    let s = '';
    const n = lines || 5;
    for (let i = 0; i < n; i++) s += line(x1, top + i * SP, x2, top + i * SP, 1.1);
    return s;
  }

  function singleLine(x1, x2, y) { return line(x1, y, x2, y, 1.3); }

  function barline(x, top, bottom, w) { return line(x, top, x, bottom, w || 1.3); }

  // Ledger lines for a note at staff position `pos`.
  function ledgers(x, pos, top) {
    let s = '';
    const w = 9.5;
    for (let p = -2; p >= pos; p -= 2) s += line(x - w, posToY(p, top), x + w, posToY(p, top), 1.2);
    for (let p = 10; p <= pos; p += 2) s += line(x - w, posToY(p, top), x + w, posToY(p, top), 1.2);
    return s;
  }

  /* ---------- clefs (drawn with the staff's top line at y = 0) ---------- */

  function trebleClef(x, top) {
    const body =
      strokePath('M14.6,31.2 C11.2,31.6 9.6,27.4 12.2,25.2 C15.2,22.8 20.6,24.8 20.8,30.2 ' +
        'C21,36.4 15.4,40.6 10,39.6 C4,38.4 1.4,32.6 3,26.4 C4.6,19.8 10,15.2 14,10.4 ' +
        'C18,5.4 19.8,-1.6 18.8,-8.4 C18.2,-13.2 16.6,-16.6 15.2,-16.8 ' +
        'C12.6,-15 11.6,-8.4 12.6,0.4 L15.4,46 C15.8,52.6 11.4,55 8.4,51.4', 2.3) +
      circle(8.9, 49.6, 3.3);
    return g('translate(' + r(x) + ',' + r(top) + ')', body);
  }

  function bassClef(x, top) {
    const body =
      fillPath('M1.4,9 C1.6,0.8 11.4,-1.6 17.4,3.4 C23.2,8.4 22,19.4 14,26.6 ' +
        'C9.8,30.4 5.6,32.6 0.8,34.4 C6.8,30.4 12,25.8 14.4,19.6 C17,12.6 15.4,3.6 9.2,3.2 ' +
        'C5.4,3 3.6,5.6 3.6,8.2 Z') +
      circle(4.4, 10, 3.8) + circle(25, 5, 1.8) + circle(25, 15, 1.8);
    return g('translate(' + r(x) + ',' + r(top) + ')', body);
  }

  // C clef centred on the line `c` units below the top line (alto 20, tenor 10).
  function cClef(x, top, c) {
    const bump = strokePath('M7.4,0 L11,-5.2 C13.2,-8.4 19.4,-7.4 19.4,-13.4 ' +
      'C19.4,-18.6 15.4,-20.4 12.4,-19.6 C10.2,-19 9.6,-17 10.6,-15.6', 2.2) + circle(12.6, -15.4, 2.7);
    const body = rect(0, -20, 4.4, 40) + rect(6.4, -20, 1.4, 40) +
      bump + g('scale(1,-1)', bump);
    return g('translate(' + r(x) + ',' + r(top + c) + ')', body);
  }

  function clef(type, x, top) {
    if (type === 'treble') return trebleClef(x, top);
    if (type === 'bass') return bassClef(x, top);
    if (type === 'alto') return cClef(x, top, 20);
    if (type === 'tenor') return cClef(x, top, 10);
    return '';
  }

  /* ---------- accidentals (centred on y) ---------- */

  function sharp(x, y) {
    const bar = (yy) => fillPath('M' + r(x - 1.2) + ',' + r(yy + 1.6) + ' L' + r(x + 9.2) + ',' + r(yy - 1.4) +
      ' L' + r(x + 9.2) + ',' + r(yy + 1.2) + ' L' + r(x - 1.2) + ',' + r(yy + 4.2) + 'Z');
    return line(x + 2, y - 12, x + 2, y + 14, 1.3) + line(x + 6.2, y - 14, x + 6.2, y + 12, 1.3) +
      bar(y - 5.4) + bar(y + 2.4);
  }

  function flat(x, y) {
    return line(x + 0.6, y - 17, x + 0.6, y + 5, 1.4) +
      strokePath('M' + r(x + 0.6) + ',' + r(y - 1.6) + ' C' + r(x + 3.4) + ',' + r(y - 6.4) + ' ' +
        r(x + 9.4) + ',' + r(y - 6) + ' ' + r(x + 8.2) + ',' + r(y - 1.4) + ' C' + r(x + 7.2) + ',' +
        r(y + 1.6) + ' ' + r(x + 3.8) + ',' + r(y + 3.4) + ' ' + r(x + 0.6) + ',' + r(y + 5), 2);
  }

  function natural(x, y) {
    const bar = (yy) => fillPath('M' + r(x) + ',' + r(yy + 1.4) + ' L' + r(x + 6.6) + ',' + r(yy - 0.8) +
      ' L' + r(x + 6.6) + ',' + r(yy + 1.8) + ' L' + r(x) + ',' + r(yy + 4) + 'Z');
    return line(x + 0.6, y - 14, x + 0.6, y + 5.4, 1.3) + line(x + 6, y - 5.4, x + 6, y + 14, 1.3) +
      bar(y - 5) + bar(y + 1.6);
  }

  // Double sharp: a small x with blocky ends, about one staff space wide.
  function doubleSharp(x, y) {
    const c = x + 4.5, h = 3.4, e = 2.6;
    let s = strokePath('M' + r(c - h) + ',' + r(y - h) + ' L' + r(c + h) + ',' + r(y + h) +
      ' M' + r(c + h) + ',' + r(y - h) + ' L' + r(c - h) + ',' + r(y + h), 1.5, 'butt');
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
      s += rect(c + dx * (h + 0.4) - e / 2, y + dy * (h + 0.4) - e / 2, e, e);
    });
    return s;
  }

  function accidental(acc, x, y) {
    if (acc === 'x') return doubleSharp(x, y);
    if (acc === '#') return sharp(x, y);
    if (acc === 'b') return flat(x, y);
    if (acc === 'n') return natural(x, y);
    return '';
  }

  /* ---------- notes ---------- */

  function notehead(x, y, kind) {
    if (kind === 'whole') {
      return g('translate(' + r(x) + ',' + r(y) + ')',
        '<path fill-rule="evenodd" d="' + ellipsePath(7.6, 4.9) + '"/>' +
        g('rotate(55)', '<path fill="#fff" d="' + ellipsePath(3.6, 2.7) + '"/>'));
    }
    if (kind === 'half') {
      return g('translate(' + r(x) + ',' + r(y) + ') rotate(-22)',
        '<path fill-rule="evenodd" d="' + ellipsePath(6.4, 4.5) + ' ' + ellipsePath(5.2, 2.2) + '"/>');
    }
    return g('translate(' + r(x) + ',' + r(y) + ') rotate(-22)', '<path d="' + ellipsePath(6.4, 4.5) + '"/>');
  }

  // Flag(s) on a stem whose free end is at (sx, sy).
  function flags(sx, sy, count, up) {
    let s = '';
    for (let i = 0; i < count; i++) {
      const o = i * 8 * (up ? 1 : -1);
      const d = up
        ? 'M' + r(sx) + ',' + r(sy + o) + ' C' + r(sx + 0.6) + ',' + r(sy + o + 7) + ' ' + r(sx + 11.6) + ',' +
          r(sy + o + 11) + ' ' + r(sx + 9) + ',' + r(sy + o + 23) + ' C' + r(sx + 9.6) + ',' + r(sy + o + 15) + ' ' +
          r(sx + 4) + ',' + r(sy + o + 11.4) + ' ' + r(sx) + ',' + r(sy + o + 9.6) + 'Z'
        : 'M' + r(sx) + ',' + r(sy + o) + ' C' + r(sx + 0.6) + ',' + r(sy + o - 7) + ' ' + r(sx + 11.6) + ',' +
          r(sy + o - 11) + ' ' + r(sx + 9) + ',' + r(sy + o - 23) + ' C' + r(sx + 9.6) + ',' + r(sy + o - 15) + ' ' +
          r(sx + 4) + ',' + r(sy + o - 11.4) + ' ' + r(sx) + ',' + r(sy + o - 9.6) + 'Z';
      s += fillPath(d);
    }
    return s;
  }

  const FLAG_COUNT = { '8': 1, '16': 2 };

  /*
   * A single note. opts: { dur: 'w'|'h'|'q'|'8'|'16', up: bool, dots: n,
   *   stemLen, noFlag: bool (for beamed notes), dotUp: bool (note on a line) }
   * Returns { svg, stemX, stemEnd }.
   */
  function note(x, y, opts) {
    const dur = opts.dur;
    const up = opts.up !== false;
    let s = notehead(x, y, dur === 'w' ? 'whole' : dur === 'h' ? 'half' : 'filled');
    let stemX = null, stemEnd = null;
    if (dur !== 'w') {
      const len = opts.stemLen || 35;
      stemX = up ? x + 5.7 : x - 5.7;
      stemEnd = up ? y - len : y + len;
      s += line(stemX, up ? y - 1.2 : y + 1.2, stemX, stemEnd, 1.3);
      if (!opts.noFlag && FLAG_COUNT[dur]) s += flags(stemX, stemEnd, FLAG_COUNT[dur], up);
    }
    for (let i = 0; i < (opts.dots || 0); i++) {
      s += circle(x + (dur === 'w' ? 12 : 10.5) + i * 5, y - (opts.dotUp ? HALF : 0), 1.9);
    }
    return { svg: s, stemX: stemX, stemEnd: stemEnd };
  }

  // A horizontal beam joining stems (all stems up, ending at yTop).
  function beam(x1, x2, yTop, level) {
    const y = yTop + (level || 0) * 7.5;
    return rect(x1 - 0.65, y, x2 - x1 + 1.3, 5);
  }

  /* ---------- rests (centred on the middle line at y) ---------- */

  function rest(kind, x, mid) {
    if (kind === 'w') return rect(x - 6.5, mid - SP, 13, 5.2);       // hangs from line 4
    if (kind === 'h') return rect(x - 6.5, mid - 5.2, 13, 5.2);       // sits on line 3
    if (kind === 'q') {
      return g('translate(' + r(x - 5) + ',' + r(mid) + ')',
        strokePath('M2,-14.5 L8.2,-6.4', 1.7) +
        strokePath('M8.2,-6.4 L2.6,0', 4.4) +
        strokePath('M2.6,0 L8.4,6.2', 1.7) +
        strokePath('M8.4,6.2 C4.4,3.8 0.8,6.8 2.4,10.6 C3.2,12.6 4.8,14 6.4,15', 2.6));
    }
    if (kind === '8') {
      return g('translate(' + r(x - 4) + ',' + r(mid) + ')',
        circle(1.8, -4.6, 2.9) +
        strokePath('M1.8,-2.6 C4,-0.8 7,-2.6 8.6,-6 L3.6,11', 1.5));
    }
    return '';
  }

  /* ---------- symbols ---------- */

  function downBow(x, y) {   // ⊓ — (x, y) is the top-left corner
    return rect(x, y, 14, 3.6) + line(x + 0.6, y, x + 0.6, y + 11, 1.3) + line(x + 13.4, y, x + 13.4, y + 11, 1.3);
  }
  function upBow(x, y) {     // V — (x, y) is the top-left corner
    return strokePath('M' + r(x) + ',' + r(y) + ' L' + r(x + 5.5) + ',' + r(y + 14) + ' L' + r(x + 11) + ',' + r(y), 1.4, 'butt');
  }
  function staccatoDot(x, y) { return circle(x, y, 1.9); }
  function accentMark(x, y) {
    return strokePath('M' + r(x - 5.5) + ',' + r(y - 3.6) + ' L' + r(x + 5.5) + ',' + r(y) + ' L' + r(x - 5.5) + ',' + r(y + 3.6), 1.5, 'butt');
  }
  function tenutoMark(x, y) { return rect(x - 5.5, y - 1, 11, 2); }
  function fermata(x, y) {   // (x, y) is the centre of the base
    return fillPath('M' + r(x - 12) + ',' + r(y) + ' C' + r(x - 12) + ',' + r(y - 15.5) + ' ' + r(x + 12) + ',' + r(y - 15.5) + ' ' +
      r(x + 12) + ',' + r(y) + ' C' + r(x + 10) + ',' + r(y - 11.4) + ' ' + r(x - 10) + ',' + r(y - 11.4) + ' ' + r(x - 12) + ',' + r(y) + 'Z') +
      circle(x, y - 3, 2.1);
  }
  // A slur or tie curve between two points; bulges downward if `down`.
  function curve(x1, y1, x2, y2, down, height) {
    const h = (height || 7) * (down ? 1 : -1);
    const mx1 = x1 + (x2 - x1) * 0.25, mx2 = x1 + (x2 - x1) * 0.75;
    return fillPath('M' + r(x1) + ',' + r(y1) + ' C' + r(mx1) + ',' + r(y1 + h) + ' ' + r(mx2) + ',' + r(y2 + h) + ' ' + r(x2) + ',' + r(y2) +
      ' C' + r(mx2) + ',' + r(y2 + h * 0.7) + ' ' + r(mx1) + ',' + r(y1 + h * 0.7) + ' ' + r(x1) + ',' + r(y1) + 'Z');
  }
  function hairpin(x1, x2, y, opening) {
    const h = 7;
    return opening
      ? strokePath('M' + r(x2) + ',' + r(y - h) + ' L' + r(x1) + ',' + r(y) + ' L' + r(x2) + ',' + r(y + h), 2.2, 'butt')
      : strokePath('M' + r(x1) + ',' + r(y - h) + ' L' + r(x2) + ',' + r(y) + ' L' + r(x1) + ',' + r(y + h), 2.2, 'butt');
  }
  function repeatDots(x, top) { return circle(x, top + 15, 2) + circle(x, top + 25, 2); }
  function endRepeat(x, top) {   // x = right edge
    return repeatDots(x - 11, top) + line(x - 6.5, top, x - 6.5, top + 40, 1.3) + rect(x - 4, top, 4, 40);
  }
  function startRepeat(x, top) { // x = left edge
    return rect(x, top, 4, 40) + line(x + 6.5, top, x + 6.5, top + 40, 1.3) + repeatDots(x + 11, top);
  }
  function finalBarline(x, top) { return line(x - 7, top, x - 7, top + 40, 1.3) + rect(x - 4.5, top, 4.5, 40); }
  function coda(x, y) {
    return '<ellipse cx="' + r(x) + '" cy="' + r(y) + '" rx="9" ry="11" fill="none" stroke="' + INK + '" stroke-width="3.2"/>' +
      line(x, y - 17, x, y + 17, 1.6) + line(x - 15, y, x + 15, y, 1.6);
  }
  function dynamicText(x, y, str, size) {
    return text(x, y, str, size || 40, { spacing: -1 });
  }

  global.Notation = {
    SP: SP, HALF: HALF, svg: svg, g: g, rect: rect, line: line, circle: circle, text: text,
    staff: staff, singleLine: singleLine, barline: barline, ledgers: ledgers,
    clef: clef, accidental: accidental, note: note, notehead: notehead, beam: beam, rest: rest,
    staffPos: staffPos, posToY: posToY, diatonic: diatonic,
    downBow: downBow, upBow: upBow, staccatoDot: staccatoDot, accentMark: accentMark,
    tenutoMark: tenutoMark, fermata: fermata, curve: curve, hairpin: hairpin,
    endRepeat: endRepeat, startRepeat: startRepeat, finalBarline: finalBarline, coda: coda,
    dynamicText: dynamicText, strokePath: strokePath, fillPath: fillPath
  };
})(window);
