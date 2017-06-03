const ejs = require('ejs');
const fs = require('fs');

function squeakyClean(arr) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null || arr[i] === '') {
      arr.splice(i, 1);
    }
  }
  return arr;
}

module.exports = (dir, pageMappingData) => {
  return {
    partial(path, data) {
      const newPath = `${dir.src}partials/${path}.ejs`;

      return ejs.render(fs.readFileSync(newPath).toString(), data, {
        compileDebug: true,
      });
    },

    getChildPages(parentPath) {
      return pageMappingData.filter((page) => {
        const splitUrl = page.url.split('/');
        squeakyClean(splitUrl);
        const iOf = splitUrl.indexOf(parentPath);
        const len = splitUrl.length - 1;
        if (parentPath === '') {
          return len === 0 && !page.url.includes('.html');
        } else if (iOf === -1) {
          return false;
        } else if (len - iOf === 1) {
          return true;
        }
        return false;
      });
    },
  };
};
