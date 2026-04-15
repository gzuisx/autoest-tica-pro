import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

/**
 * Recursively sanitizes all string values in an object, removing
 * HTML/script tags to prevent XSS. Applied globally to req.body.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return xss(value, {
      whiteList: {}, // strip ALL tags — we never want HTML in API inputs
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
    });
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitized[k] = sanitizeValue(v);
    }
    return sanitized;
  }
  return value;
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}
