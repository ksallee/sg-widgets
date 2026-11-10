/** The Project checkboxes eligibility reads; request them with the projects. */
export const PROJECT_ELIGIBILITY_FIELDS = ['is_template', 'archived', 'is_demo'] as const;

/** A project row holding the eligibility checkboxes by programmatic name. */
export type EligibilityFlags = { readonly [K in (typeof PROJECT_ELIGIBILITY_FIELDS)[number]]?: unknown };

/**
 * Whether a project is eligible for field visibility: not a template, not archived, not
 * a demo project. Status is never read: `sg_status` is null on most working projects
 * (findings/018_project_listing). Only a flag that is `true` excludes; the probed site
 * never returned a null checkbox.
 */
export function isEligibleProject<T extends EligibilityFlags>(project: T): boolean {
  return PROJECT_ELIGIBILITY_FIELDS.every((field) => project[field] !== true);
}

/** The eligible projects, in their order. */
export function eligibleProjects<T extends EligibilityFlags>(projects: readonly T[]): T[] {
  return projects.filter(isEligibleProject);
}
