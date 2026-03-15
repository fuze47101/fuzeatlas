/**
 * Lightweight request validation without external dependencies.
 *
 * When you're ready for full Zod:
 *   npm install zod
 *   Then replace these helpers with z.object() schemas.
 *
 * For now, this provides typed validation for all API routes
 * without adding a dependency.
 */

import { NextResponse } from "next/server";

// ── Validation result ────────────────────────────────────────
interface ValidationOk<T> {
  ok: true;
  data: T;
}
interface ValidationErr {
  ok: false;
  error: string;
  response: NextResponse;
}
type ValidationResult<T> = ValidationOk<T> | ValidationErr;

// ── Field definition ─────────────────────────────────────────
type FieldType = "string" | "number" | "boolean" | "email" | "array" | "object";

interface FieldDef {
  type: FieldType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** Custom label for error messages */
  label?: string;
}

type SchemaMap = Record<string, FieldType | FieldDef>;

// ── Email regex ──────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Core validator ───────────────────────────────────────────
export function validateBody<T extends Record<string, unknown>>(
  body: unknown,
  schema: SchemaMap
): ValidationResult<T> {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: "Request body is required",
      response: NextResponse.json(
        { ok: false, error: "Request body is required" },
        { status: 400 }
      ),
    };
  }

  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  for (const [field, def] of Object.entries(schema)) {
    const spec: FieldDef = typeof def === "string" ? { type: def, required: true } : def;
    const label = spec.label || field;
    const value = data[field];

    // Required check
    if (spec.required !== false && (value === undefined || value === null || value === "")) {
      errors.push(`${label} is required`);
      continue;
    }

    // Skip optional missing fields
    if (value === undefined || value === null || value === "") continue;

    // Type checks
    switch (spec.type) {
      case "string":
        if (typeof value !== "string") {
          errors.push(`${label} must be a string`);
        } else {
          if (spec.minLength && value.length < spec.minLength)
            errors.push(`${label} must be at least ${spec.minLength} characters`);
          if (spec.maxLength && value.length > spec.maxLength)
            errors.push(`${label} must be at most ${spec.maxLength} characters`);
        }
        break;

      case "email":
        if (typeof value !== "string" || !EMAIL_RE.test(value)) {
          errors.push(`${label} must be a valid email address`);
        }
        break;

      case "number":
        const num = typeof value === "string" ? Number(value) : value;
        if (typeof num !== "number" || isNaN(num)) {
          errors.push(`${label} must be a number`);
        } else {
          if (spec.min !== undefined && num < spec.min)
            errors.push(`${label} must be at least ${spec.min}`);
          if (spec.max !== undefined && num > spec.max)
            errors.push(`${label} must be at most ${spec.max}`);
        }
        break;

      case "boolean":
        if (typeof value !== "boolean") errors.push(`${label} must be true or false`);
        break;

      case "array":
        if (!Array.isArray(value)) errors.push(`${label} must be an array`);
        break;

      case "object":
        if (typeof value !== "object" || Array.isArray(value))
          errors.push(`${label} must be an object`);
        break;
    }
  }

  if (errors.length > 0) {
    const msg = errors.join("; ");
    return {
      ok: false,
      error: msg,
      response: NextResponse.json({ ok: false, error: msg }, { status: 400 }),
    };
  }

  return { ok: true, data: data as T };
}

/**
 * Sanitize a string to prevent XSS.
 * Strips HTML tags and trims whitespace.
 */
export function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Sanitize all string values in an object.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === "string" ? sanitize(value) : value;
  }
  return result as T;
}
