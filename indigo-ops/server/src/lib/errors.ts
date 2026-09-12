export class OpsError extends Error {
  code: string;
  title: string;
  status: number;
  constructor(code: string, title: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.title = title;
    this.status = status;
  }
}

export function opsErrorPayload(err: OpsError) {
  return {
    error: {
      code: err.code,
      title: err.title,
      message: err.message,
    },
  };
}
