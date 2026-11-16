#!/usr/bin/env node
/**
 * Last step of deploy:prepare. The live host publishes everything in dist,
 * so config files meant for other hosts and the build stamp would be served
 * to any visitor. Build, optimize and validate use them first; this removes
 * them from what gets published. Local preview and tests run on the unpruned
 * build (test:deploy does not call this).
 */
(function () {
    'use strict';

    const fs = require('fs');
    const path = require('path');

    const NOT_PUBLIC = ['.htaccess', '_headers', '_redirects', '.nojekyll', 'CNAME', 'build-info.json'];

    function prunePublic(distDir) {
        const removed = [];
        for (const name of NOT_PUBLIC) {
            const file = path.join(distDir, name);
            if (fs.existsSync(file)) {
                fs.rmSync(file, { force: true });
                removed.push(name);
            }
        }
        return removed;
    }

    module.exports = { prunePublic, NOT_PUBLIC };

    if (require.main === module) {
        const dist = path.resolve(__dirname, '..', 'dist');
        const removed = prunePublic(dist);
        console.log(`prune-public: removed ${removed.length ? removed.join(', ') : 'nothing'} from dist`);
    }
})();
