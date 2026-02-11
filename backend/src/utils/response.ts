import { Response } from "express";

export function ok(res: Response, data?: any) {
  return res.json({ ok: true, data: data ?? null });
}

export function created(res: Response, data?: any) {
  return res.status(201).json({ ok: true, data: data ?? null });
}
