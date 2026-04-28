export class R1TimeoutError extends Error {
  readonly code = "R1_TIMEOUT" as const;
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`R1 call timed out after ${timeoutMs}ms`);
    this.name = "R1TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class R1ProtocolError extends Error {
  readonly code = "R1_PROTOCOL" as const;
  readonly status: number | undefined;
  readonly bodySnippet: string | undefined;

  constructor(message: string, status?: number, bodySnippet?: string) {
    super(message);
    this.name = "R1ProtocolError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}
