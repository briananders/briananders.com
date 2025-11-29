const path = require('path');
const { optimize } = require('svgo');
const { readFileSync, writeFile, mkdirpSync } = require('fs-extra');

const plugins = [
  {
    name: 'preset-default',
    params: {
      overrides: {
        removeViewBox: false,
        removeDoctype: false,
      },
    },
  }
];

function getSVG(filePath) {
  const svgString = readFileSync(filePath);

  const { data } = optimize(svgString, {
    path: filePath,
    plugins,
  });

  return data;
}

function optimizeSvg(filePath, { dir }) {
  const svgString = readFileSync(filePath);
  const destination = filePath.replace(dir.src, dir.package);

  const { data } = optimize(svgString, {
    path: filePath,
    plugins,
  });

  mkdirpSync(path.dirname(destination));

  writeFile(destination, data, (e) => {
    if (e) throw e;
  });
}

module.exports = {
  getSVG,
  optimizeSvg,
};
