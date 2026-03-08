module.exports = (appRoot, isGoldenBuild = false) => ({
  root: `${appRoot}/`,
  src: `${appRoot}/src/`,
  package: isGoldenBuild ? `${appRoot}/golden/` : `${appRoot}/package/`,
  build: `${appRoot}/build/`,
  nodeModules: `${appRoot}/node_modules/`,
});
