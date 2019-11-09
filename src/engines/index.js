const fs = require('fs');

fs.readdirSync(__dirname).forEach(fileName => {
  module.exports[fileName.replace(/\.js$/, '')] = require('./' + fileName);
});
