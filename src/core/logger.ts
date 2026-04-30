/**
 * 统一日志模块
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isWindows = process.platform === 'win32';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isProduction ? {} : {
    transport: isWindows ? undefined : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

export default logger;