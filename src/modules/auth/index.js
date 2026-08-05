const controller = require('./controller');
const service = require('./service');
const repository = require('./repository');
const routes = require('./routes');
const validator = require('./validator');

module.exports = {
  ...controller,
  ...service,
  ...repository,
  ...routes,
  ...validator
};
