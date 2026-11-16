/**
 * Build step for the "Reduce motion" switch (D-49). The switch sets
 * data-motion="reduce" on <html>. CSS only knows the device setting, so the
 * bundler rewrites the stylesheet once:
 *   - every rule inside @media (prefers-reduced-motion: reduce) is also
 *     copied outside it, under :root[data-motion="reduce"];
 *   - every rule inside @media (prefers-reduced-motion: no-preference) is
 *     limited to :root:not([data-motion="reduce"]).
 * The added parts sit in :where(), so no rule changes specificity.
 */
(function () {
    'use strict';

    const postcss = require('postcss');

    const ON = ':where(:root[data-motion="reduce"])';
    const OFF = ':where(:root:not([data-motion="reduce"]))';
    const REDUCE = /prefers-reduced-motion\s*:\s*reduce/i;
    const NO_PREF = /prefers-reduced-motion\s*:\s*no-preference/i;

    function scope(selector, on) {
        const s = selector.trim();
        const attr = on ? ':where([data-motion="reduce"])' : ':where(:not([data-motion="reduce"]))';
        const root = s.match(/^(html|:root)(?![\w-])/);
        if (root) return root[1] + attr + s.slice(root[1].length);
        if (s.startsWith('::')) return (on ? ON : OFF) + s;
        return `${on ? ON : OFF} ${s}`;
    }

    function inKeyframes(node) {
        for (let p = node.parent; p; p = p.parent) {
            if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true;
        }
        return false;
    }

    function addMotionSwitch(css) {
        const root = postcss.parse(css);
        let changed = false;
        root.walkAtRules('media', (at) => {
            if (REDUCE.test(at.params)) {
                const copies = [];
                at.each((child) => {
                    if (child.type !== 'rule') return;
                    const copy = child.clone();
                    copy.selectors = child.selectors.map((s) => scope(s, true));
                    copies.push(copy);
                });
                if (copies.length) {
                    at.after(copies);
                    changed = true;
                }
            } else if (NO_PREF.test(at.params)) {
                at.walkRules((rule) => {
                    if (inKeyframes(rule)) return;
                    rule.selectors = rule.selectors.map((s) => scope(s, false));
                    changed = true;
                });
            }
        });
        return changed ? root.toString() : css;
    }

    module.exports = { addMotionSwitch, ON, OFF };
})();
