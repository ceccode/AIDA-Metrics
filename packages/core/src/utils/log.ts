export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export class ConsoleLogger implements Logger {
  constructor(private verbose: boolean = false) {}

  info(message: string): void {
    console.log(`[INFO] ${message}`);
  }

  warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }

  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(`[DEBUG] ${message}`);
    }
  }
}

export const createLogger = (verbose: boolean = false): Logger => {
  return new ConsoleLogger(verbose);
};
