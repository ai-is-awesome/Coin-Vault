import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { AppError, isRecordNotFound, uniqueViolation } from '../lib/errors.js';

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details === undefined ? {} : { details }) } });
}

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) return sendError(res, err.status, err.code, err.message, err.details);

  // body-parser / http-errors (malformed JSON, oversized body, unsupported charset, ...)
  const httpError = err as { status?: number; type?: string; expose?: boolean; message?: string };
  if (httpError.type === 'entity.parse.failed')
    return sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
  if (httpError.status === 413) return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (httpError.expose && httpError.status && httpError.status < 500) {
    return sendError(res, httpError.status, 'BAD_REQUEST', httpError.message ?? 'Bad request');
  }

  if (uniqueViolation(err)) return sendError(res, 409, 'CONFLICT', 'The resource conflicts with an existing one');
  if (isRecordNotFound(err)) return sendError(res, 404, 'NOT_FOUND', 'Resource not found');

  req.log?.error({ err }, 'Unhandled error');
  sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong');
};
