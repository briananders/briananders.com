module.exports = (appRoot, isComparisonBuild = false) => ({
  root: `${appRoot}/`,
  src: `${appRoot}/src/`,
  package: isComparisonBuild ? `${appRoot}/comparison/` : `${appRoot}/package/`,
  build: `${appRoot}/build/`,
  jsOutputPath: isComparisonBuild ? `${appRoot}/comparison/scripts/` : `${appRoot}/package/scripts/`,
  nodeModules: `${appRoot}/node_modules/`,
});
