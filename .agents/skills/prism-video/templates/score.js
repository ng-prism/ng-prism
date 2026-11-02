// The sound of every ng-prism film: no music (the maintainer's call, after a quiet and a loud score were both too much),
// only the product's own sounds on their frames. Keystrokes come from every kit.typist on their own; list the cursor's
// clicks per film as [scene id, seconds into the scene], the same times as the scene's cur.clicks.
const CLICKS = [
    ['look', 2.55],
    ['look', 5.0],
    ['pages', 2.5],
    ['parts', 3.8],
    ['a11y', 4.1],
    ['perf', 2.2]
];
kit.score(function (S, T) {
    S.ticks(kit.typing.times, { vel: 34 });
    for (const [id, s] of CLICKS) if (T[id] !== undefined) S.fx('click', T[id] + s, { vel: 72 });
    S.master({ gain: -6, fadeOut: 0.5 });
});
