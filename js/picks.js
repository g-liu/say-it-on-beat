/*
 * picks.js — what the All / None and Only buttons do to the picked chips. Pure functions, so
 * `node tools/check_picks.js` can test them.
 *
 * A subcategory is { id, chips: [{ id }], fixed (always on, keeps one pick), defaults }.
 * `pickable` is the chips the current settings allow (not hidden or greyed out).
 */
(function (global) {
  'use strict';

  const inOrder = (sc, list) => {
    const order = sc.chips.map((c) => c.id);
    return list.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
  };
  const everyPicked = (list, pickable) => pickable.length > 0 && pickable.every((id) => list.indexOf(id) >= 0);

  const allNoneLabel = (list, pickable) => (everyPicked(list, pickable) ? 'none' : 'all');

  function allNonePicks(sc, list, pickable) {
    if (!everyPicked(list, pickable)) return inOrder(sc, list.concat(pickable.filter((id) => list.indexOf(id) < 0)));
    if (!sc.fixed) return [];
    const keep = (sc.defaults || []).concat(pickable).find((id) => pickable.indexOf(id) >= 0);
    return keep ? [keep] : list.slice(0, 1);
  }

  function onlyPicks(subs, id, sel, lastSel, defaultsOf) {
    const next = { sel: Object.assign({}, sel), lastSel: Object.assign({}, lastSel) };
    subs.forEach((sc) => {
      const list = sel[sc.id] || [];
      if (sc.id === id) {
        if (!list.length) next.sel[sc.id] = ((lastSel[sc.id] || []).length ? lastSel[sc.id] : defaultsOf(sc.id)).slice();
      } else if (!sc.fixed && list.length) {
        next.lastSel[sc.id] = list.slice();
        next.sel[sc.id] = [];
      }
    });
    return next;
  }

  const onlyMakesSense = (subs, id) => subs.some((sc) => sc.id !== id && !sc.fixed);
  const isOnlyOne = (subs, id, sel) => (sel[id] || []).length > 0 &&
    subs.every((sc) => sc.id === id || sc.fixed || !(sel[sc.id] || []).length);

  global.Picks = { allNoneLabel: allNoneLabel, allNonePicks: allNonePicks, onlyPicks: onlyPicks,
    onlyMakesSense: onlyMakesSense, isOnlyOne: isOnlyOne };
})(typeof window !== 'undefined' ? window : globalThis);
