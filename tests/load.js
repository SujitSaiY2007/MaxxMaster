// Loads the game's logic files (everything that does not touch the DOM) into Node.
// Each file attaches itself to the global FP object, exactly as it does in the browser.
for (const file of ['core/util', 'core/bayes', 'core/metrics', 'core/anomaly', 'data']) {
  require(`../js/${file}.js`);
}

module.exports = globalThis.FP;
