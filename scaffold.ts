import type { BuildDirectories } from './build/types.ts';

const fs: typeof import('fs-extra') = require('fs-extra');
const path: typeof import('node:path') = require('path');

const cssTemplate: (options: { className: string }) => string = require('./scaffold/css.ts');
const htmlTemplate: (options: { className: string; pageName: string }) => string = require('./scaffold/html.ts');
const tsTemplate: () => string = require('./scaffold/ts.ts');

const getDirectories: (appRoot: string, isGoldenBuild?: boolean) => BuildDirectories = require(
  './build/constants/directories.ts',
);
const dir = getDirectories(__dirname);

/**
 * Generates initial SCSS, TypeScript, and EJS template files for a new page.
 */
function scaffoldPage(): void {
  const argPath = process.env.npm_config_path;

  if (argPath === undefined) {
    console.error('Path argument required! Example: --path=/test');
    return;
  }

  console.log(argPath);

  const pageName = argPath.substring(1);
  const stylesLocation = path.join(dir.src, `/styles/${pageName}.scss`);
  const scriptsLocation = path.join(dir.src, `/ts/${pageName}.ts`);
  const ejsLocation = path.join(dir.src, `/templates/${pageName}.ejs`);
  const scssClass = argPath.replace(/\//g, '.');
  const htmlClass = pageName.replace(/\//g, ' ');

  // Create scripts file using TypeScript template
  fs.mkdirpSync(path.dirname(scriptsLocation));
  fs.writeFile(scriptsLocation, tsTemplate(), (err: NodeJS.ErrnoException | null) => {
    if (err) throw err;
    console.log(`${scriptsLocation} successfully created`);
  });

  // Create stylesheet file using SCSS template
  fs.mkdirpSync(path.dirname(stylesLocation));
  fs.writeFile(stylesLocation, cssTemplate({ className: scssClass }), (err: NodeJS.ErrnoException | null) => {
    if (err) throw err;
    console.log(`${stylesLocation} successfully created`);
  });

  // Create template file using EJS/HTML template
  fs.mkdirpSync(path.dirname(ejsLocation));
  fs.writeFile(ejsLocation, htmlTemplate({ className: htmlClass, pageName }), (err: NodeJS.ErrnoException | null) => {
    if (err) throw err;
    console.log(`${ejsLocation} successfully created`);
  });
}

scaffoldPage();

