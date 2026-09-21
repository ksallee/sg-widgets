/**
 * One entity type's fields, read through the context and kept.
 *
 * The schema service caches, so this reaches the network once per type however
 * often the widget redraws (probe 002).
 */
import { useEffect, useState } from 'react';
import type { FieldSchema, SgContext } from '@sg-widgets/core';

/** The fields by name. Empty until the first read lands. */
export function useEntityFields(context: SgContext, entityType: string): Record<string, FieldSchema> {
  const [fields, setFields] = useState<Record<string, FieldSchema>>({});
  useEffect(() => {
    let live = true;
    context.schema
      .fields(entityType)
      .then((loaded) => {
        if (live) setFields(loaded);
      })
      .catch(() => {
        // A type whose schema the site cannot answer still draws: a field reads as its path.
      });
    return () => {
      live = false;
    };
  }, [context.schema, entityType]);
  return fields;
}
