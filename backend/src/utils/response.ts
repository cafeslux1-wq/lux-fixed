import { Response } from 'express';

export function sendSuccess(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function sendCreated(res: Response, data: unknown): void {
  res.status(201).json({ success: true, data });
}

export function sendError(res: Response, error: string, status = 500): void {
  res.status(status).json({ success: false, error });
}

export function sendNotFound(res: Response, entity = 'Resource'): void {
  res.status(404).json({ success: false, error: `${entity} not found` });
}

export function sendForbidden(res: Response, reason = 'Forbidden'): void {
  res.status(403).json({ success: false, error: reason });
}

export function sendPaginated(
  res: Response,
  rows:    unknown[],
  total:   number,
  page:    number,
  perPage: number,
): void {
  res.status(200).json({
    success: true,
    data:    rows,
    meta:    { total, page, per_page: perPage, pages: Math.ceil(total / perPage) },
  });
}

export function sendUnauthorized(res: Response, reason = 'Unauthorized'): void {
  res.status(401).json({ success: false, error: reason });
}
