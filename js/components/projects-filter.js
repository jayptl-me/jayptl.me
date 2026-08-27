/**
 * Projects Filter Component
 * Category filtering for the /projects index page.
 *
 * @file js/components/projects-filter.js
 * @author Jay Patel
 */

(function () {
    'use strict';

    function init() {
        const buttons = document.querySelectorAll('.filter-btn[data-filter]');
        const cards = document.querySelectorAll('#projectGrid .project-card');
        const empty = document.getElementById('projectsEmpty');

        if (!buttons.length || !cards.length) return;

        function applyFilter(filter) {
            let visible = 0;

            cards.forEach((card) => {
                const match = filter === 'all' || card.dataset.category === filter;
                card.hidden = !match;
                if (match) visible++;
            });

            empty.hidden = visible !== 0;
        }

        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;

                buttons.forEach((b) => {
                    const active = b === btn;
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-pressed', String(active));
                    b.disabled = false; // keep all focusable
                });

                applyFilter(filter);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
