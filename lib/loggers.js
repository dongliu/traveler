const winston = require('winston');
const { format } = winston;

winston.loggers.add('production', {
  format: format.json(),
  level: 'info',
  transports: [new winston.transports.Console()],
});

winston.loggers.add('development', {
  format: format.simple(),
  level: 'debug',
  transports: [new winston.transports.Console()],
});

module.exports.getLogger = function() {
  let env = process.env.NODE_ENV;
  if (env === 'production') {
    return winston.loggers.get('production');
  }
  return winston.loggers.get('development');
};
