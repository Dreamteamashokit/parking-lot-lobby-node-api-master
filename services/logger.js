const winston = require('winston');

const logConfiguration = {
    'transports': [
        new winston.transports.File({
            level: 'error',
            filename: 'logs/errors.log'
        })
    ],
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'MMM-DD-YYYY HH:mm:ss'
        }),
        winston.format.printf(info => `${info.level}: ${[info.timestamp]}: ${info.message}`),
    )
};

const logger = winston.createLogger(logConfiguration);

module.exports = {
    error: (message) => {
        message = typeof message === 'string' ? message : JSON.stringify({message})
        logger.error(message)
    }
}