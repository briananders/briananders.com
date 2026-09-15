/** Serialize template builds and coalesce edits received during an active render. */
module.exports = (configs, render) => {
  let assets = false;
  let mapping = false;
  let running = false;
  let pending = false;
  async function drain() {
    if (!assets || !mapping || running) return;
    running = true;
    try {
      while (pending) {
        pending = false;
        await render({ ...configs, pageMappingData: structuredClone(configs.pageMappingData) });
      }
    } finally {
      running = false;
    }
  }
  return {
    assetsReady() { assets = true; return drain(); },
    mappingReady() { mapping = true; pending = true; return drain(); },
  };
};
