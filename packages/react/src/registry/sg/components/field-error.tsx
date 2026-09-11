import type * as React from 'react';

export interface FieldErrorProps {
  /** The message, or null when there is nothing to say. */
  message?: string | null;
  /** Renders the message. Default is a small destructive line under the control. */
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * The line a field editor shows under its control when a parse fails or the caller
 * names an error. Every editor in this registry draws this one.
 */
export function FieldError({ message = null, errorMessage }: FieldErrorProps): React.ReactNode {
  if (!message) return null;
  return (
    errorMessage?.(message) ?? (
      <p data-slot="field-editor-error" className="text-destructive text-xs">
        {message}
      </p>
    )
  );
}
