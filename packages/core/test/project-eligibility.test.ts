import { describe, expect, it } from 'vitest';
import {
  eligibleProjects,
  isEligibleProject,
  PROJECT_ELIGIBILITY_FIELDS,
} from '../src/project-eligibility.js';

const working = { id: 1, is_template: false, archived: false, is_demo: false };

describe('isEligibleProject', () => {
  it('reads the three checkboxes of findings/018_project_listing', () => {
    expect([...PROJECT_ELIGIBILITY_FIELDS].sort()).toEqual(['archived', 'is_demo', 'is_template']);
  });

  it('takes a project that is none of template, archived, demo', () => {
    expect(isEligibleProject(working)).toBe(true);
  });

  it('leaves out a template, an archived project and a demo project', () => {
    expect(isEligibleProject({ ...working, is_template: true })).toBe(false);
    expect(isEligibleProject({ ...working, archived: true })).toBe(false);
    expect(isEligibleProject({ ...working, is_demo: true })).toBe(false);
  });

  it('never consults status', () => {
    expect(isEligibleProject({ ...working, sg_status: null })).toBe(true);
    expect(isEligibleProject({ ...working, sg_status: 'Lost' })).toBe(true);
    expect(isEligibleProject({ ...working, is_template: true, sg_status: 'Active' })).toBe(false);
  });

  it('excludes only on a flag that is true', () => {
    expect(isEligibleProject({ id: 2, is_template: null, archived: false, is_demo: false })).toBe(true);
  });
});

describe('eligibleProjects', () => {
  it('keeps the eligible projects in order', () => {
    const projects = [
      { ...working, id: 1 },
      { ...working, id: 2, is_template: true },
      { ...working, id: 3, sg_status: null },
      { ...working, id: 4, is_demo: true },
      { ...working, id: 5, archived: true },
    ];
    expect(eligibleProjects(projects).map((p) => p.id)).toEqual([1, 3]);
  });
});
