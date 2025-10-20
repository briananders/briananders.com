module.exports = (appRoot, isComparisonBuild = false) => ({
  root: `${appRoot}/`,
  src: `${appRoot}/src/`,
  package: isComparisonBuild ? `${appRoot}/comparison/` : `${appRoot}/package/`,
  build: `${appRoot}/build/`,
  nodeModules: `${appRoot}/node_modules/`,
});
