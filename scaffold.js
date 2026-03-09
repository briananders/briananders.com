const fs = require('fs-extra');
const path = require('path');

const cssTemplate = require('./scaffold/css');
const htmlTemplate = require('./scaffold/html');
const jsTemplate = require('./scaffold/js');

const dir = require('./build/constants/directories')(__dirname);

const argPath = process.env.npm_config_path;

if (argPath === undefined) {
  console.error('Path argument required! Example: --path=/test');
  return;
}

console.log(argPath);

const pageName = argPath.substring(1);
const stylesLocation = path.join(dir.src, `/styles/${pageName}.scss`);
const scriptsLocation = path.join(dir.src, `/js/${pageName}.js`);
const ejsLocation = path.join(dir.src, `/templates/${pageName}.ejs`);
const scssClass = argPath.replace(/\//g, '.');
const htmlClass = pageName.replace(/\//g, ' ');

fs.mkdirpSync(path.dirname(scriptsLocation));
fs.writeFile(scriptsLocation, jsTemplate(), (err) => {
  if (err) throw err;
  console.log(`${scriptsLocation} successfully created`);
});
fs.mkdirpSync(path.dirname(stylesLocation));
fs.writeFile(stylesLocation, cssTemplate({ className: scssClass }), (err) => {
  if (err) throw err;
  console.log(`${stylesLocation} successfully created`);
});
fs.mkdirpSync(path.dirname(ejsLocation));
fs.writeFile(ejsLocation, htmlTemplate({ className: htmlClass, pageName }), (err) => {
  if (err) throw err;
  console.log(`${ejsLocation} successfully created`);
});
