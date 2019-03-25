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

module.exports = winston.loggers;
