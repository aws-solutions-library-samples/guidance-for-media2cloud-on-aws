const FS = require('fs');
const PATH = require('path');

const version = FS.readFileSync(PATH.join(__dirname, '.version')).toString().trim();
module.exports = {
  Id: 'SO0050',
  Name: 'media2cloud',
  Version: version,
};
