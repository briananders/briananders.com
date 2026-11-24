interface TemplateScheduler {
  assetsReady: () => Promise<void>;
  mappingReady: () => Promise<void>;
}

/** Serialize template builds and coalesce edits received during an active render. */
module.exports = <T extends { pageMappingData: unknown }>(
  configs: T,
  render: (snapshot: T) => Promise<void> | void,
): TemplateScheduler => {
  let assets = false;
  let mapping = false;
  let running = false;
  let pending = false;

  async function drain(): Promise<void> {
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
    assetsReady(): Promise<void> {
      assets = true;
      return drain();
    },
    mappingReady(): Promise<void> {
      mapping = true;
      pending = true;
      return drain();
    },
  };
};
