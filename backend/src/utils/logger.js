const levels = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = levels[process.env.LOG_LEVEL] ?? levels.info;

function log(level, message, meta = {}) {
  if (levels[level] > currentLevel) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
}

export const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};
