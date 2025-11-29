const glob = require('glob');
const matter = require('gray-matter');

const { log } = console;

module.exports = ({ dir, buildEvents, pageMappingData }) => {
  const BUILD_EVENTS = require(`${dir.build}constants/build-events`);
  const timestamp = require(`${dir.build}helpers/timestamp`);
  const templateGlob = glob.globSync(`${dir.src}templates/**/[^_]*.ejs`);

  // clean it out before compiling. No dupes.
  pageMappingData.splice(0, pageMappingData.length);

  log(`${timestamp.stamp()} compilePageMappingData()`);
  let processed = 0;
  templateGlob.forEach((templatePath, index, array) => {
    const outputPath = templatePath.replace(`${dir.src}templates/`, dir.package).replace(/\.ejs$/, (templatePath.includes('.html.ejs')) ? '' : '/index.html');
    const frontMatter = matter.read(templatePath);

    pageMappingData.push({
      url: outputPath.replace(dir.package, '').replace('index.html', ''),
      data: frontMatter.data,
    });

    processed++;
    if (processed >= array.length) {
      log(`${timestamp.stamp()} compilePageMappingData() ${'DONE'.bold.green}`);

      buildEvents.emit(BUILD_EVENTS.pageMappingDataCompiled);
    }
  });
};
