/**
 * The pure packages (core, rig, stage) compile with no DOM library and no Node types,
 * so a stray browser or Node call is a compile error. The one host call they may make
 * is a warning (an unknown id in a save, missing effect art). This is its whole type.
 */
declare const console: {
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
  info(...data: unknown[]): void;
  log(...data: unknown[]): void;
  debug(...data: unknown[]): void;
};
