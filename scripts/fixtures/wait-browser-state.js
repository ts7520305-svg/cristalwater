'use strict';
// Evaluate the resolved value in Node. Some Playwright versions treat a Promise
// returned by waitForFunction as truthy before its boolean result is available.
module.exports = async function waitBrowserState(page, predicate, argument, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  do {
    if (await page.evaluate(predicate, argument)) return;
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);
  throw Error('Browser state did not become true: ' + predicate.toString());
};
