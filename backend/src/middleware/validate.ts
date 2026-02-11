import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { HttpError } from "./error";

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues.map((i) => i.message).join(", "),
        "VALIDATION_ERROR"
      );
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues.map((i) => i.message).join(", "),
        "VALIDATION_ERROR"
      );
    }
    req.query = parsed.data as any;
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues.map((i) => i.message).join(", "),
        "VALIDATION_ERROR"
      );
    }
    req.params = parsed.data as any;
    next();
  };
}
