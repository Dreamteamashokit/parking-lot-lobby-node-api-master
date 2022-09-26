// import  *  as  winston  from  'winston';
// import  'winston-daily-rotate-file';

// const logConfiguration = {
//     'transports': [
//         new winston.transports.DailyRotateFile({
//             frequency: '1d',
//             filename: 'logs/log-%DATE%.log',
//             datePattern: 'YYYY-MM-DD-HH',
//             zippedArchive: true,
//             maxSize: '20m',
//             maxFiles: '30d'
//         })
//     ],
//     format: winston.format.combine(
//         winston.format.timestamp({
//             format: 'MMM-DD-YYYY HH:mm:ss'
//         }),
//         winston.format.printf(info => `${info.level}: ${[info.timestamp]}: ${info.message}`),
//     )
// };

// const logConfiguration2 = {
//     'transports': [
//         new winston.transports.DailyRotateFile({
//             frequency: '1d',
//             filename: 'logs/dump-%DATE%.log',
//             datePattern: 'YYYY-MM-DD-HH',
//             zippedArchive: true,
//             maxSize: '20m',
//             maxFiles: '30d'
//         })
//     ],
//     format: winston.format.combine(
//         winston.format.timestamp({
//             format: 'MMM-DD-YYYY HH:mm:ss'
//         }),
//         winston.format.printf(info => `${info.level}: ${[info.timestamp]}: ${info.message}`),
//     )
// };

// const logger = winston.createLogger(logConfiguration);
// const logger2 = winston.createLogger(logConfiguration2);


module.exports = {
    error: (message) => {
        // message = typeof message === 'string' ? message : JSON.stringify({ message })
        // logger.error(message)
    },
    dump: (message) => {
        // message = typeof message === 'string' ? message : JSON.stringify({ message })
        // logger2.info(message)
    },
}