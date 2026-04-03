#!/usr/bin/env node
/* eslint-disable no-console */

console.error(
  'CSV/JSON table replay restore has been retired for disaster recovery.'
);
console.error(
  'Use the Docker full-dump restore workflow instead: npm run docker:restore:docker-db -- <dump-file> --confirm'
);
process.exit(1);
