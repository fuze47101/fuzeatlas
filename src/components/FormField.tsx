"use client";

/**
 * <FormField /> — Phase 13D-1.
 *
 * Standard form-field wrapper with inline validation feedback.
 *
 * Usage:
 *   <FormField
 *     label="Required FUZE tier"
 *     helperText="F1 = 100 washes; F4 = 25 washes."
 *     error={errors.tier}
 *     required
 *   >
 *     <select value={tier} onChange={...} aria-invalid={!!errors.tier}>...</select>
 *   </FormField>
 *
 * The field passes through whatever input element the caller renders
 * — works with <input>, <select>, <textarea>, or a custom widget.
 * Apply `aria-invalid` on the input yourself; this wrapper handles
 * the red ring styling via [aria-invalid="true"] CSS in globals.css.
 */
import type { ReactNode } from "react";
import HelpTooltip from "@/components/HelpTooltip";

interface Props {
  label: ReactNode;
  htmlFor?: string;
  helperText?: ReactNode;
  error?: string | null;
  required?: boolean;
  tooltipTerm?: string;
  tooltipText?: string;
  className?: string;
  children: ReactNode;
}

export default function FormField({
  label,
  htmlFor,
  helperText,
  error,
  required,
  tooltipTerm,
  tooltipText,
  className = "",
  children,
}: Props) {
  return (
    <div className={`flex flex-col gap-1 ${error ? "form-field-error" : ""} ${className}`}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-slate-700 inline-flex items-center"
      >
        <span>{label}</span>
        {required && <span className="ml-1 text-red-600">*</span>}
        {(tooltipTerm || tooltipText) && (
          <HelpTooltip term={tooltipTerm} text={tooltipText} />
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-700 font-medium" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-600">{helperText}</p>
      ) : null}
    </div>
  );
}
