import type { Request, Response } from "express";
import { OpsError, opsErrorPayload } from "./errors.js";

export function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof OpsError) {
        res.status(err.status).json(opsErrorPayload(err));
      } else {
        console.error(err);
        res.status(500).json({
          error: { code: "OPS-500", title: "INTERNAL ERROR", message: (err as Error).message },
        });
      }
    }
  };
}
