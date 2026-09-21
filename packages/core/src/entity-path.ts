/** How a type is spelled in a url. Internal: nothing outside this package addresses the API by path. */
export function pluralPath(entityType: string): string {
  // The REST API addresses types by a lowercased, underscored plural: HumanUser -> human_users, Status -> statuses.
  const snake = entityType.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  if (snake.endsWith('s')) return `${snake}es`;
  if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) return `${snake.slice(0, -1)}ies`;
  return `${snake}s`;
}
