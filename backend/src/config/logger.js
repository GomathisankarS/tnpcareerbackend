const sensitive =
  /password|token|authorization|secret|cookie|credential|message|stack|reason|body|query|sql/i;
export function redactSensitive(v, depth = 0) {
  if (depth > 6) return '[REDACTED]';
  if (!v || typeof v !== 'object') return v;
  if (v instanceof Error) return { name: v.name };
  if (Array.isArray(v)) return v.map((x) => redactSensitive(x, depth + 1));
  return Object.fromEntries(
    Object.entries(v).map(([k, x]) => [
      k,
      sensitive.test(k) ? '[REDACTED]' : redactSensitive(x, depth + 1)
    ])
  );
}
function log(level, event, context = {}) {
  const output = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...redactSensitive(context)
  });
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.info(output);
}
export const logger = {
  info: (e, c) => log('info', e, c),
  warn: (e, c) => log('warn', e, c),
  error: (e, c) => log('error', e, c)
};
