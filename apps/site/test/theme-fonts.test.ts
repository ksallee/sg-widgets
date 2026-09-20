/**
 * The typefaces a pasted theme names and the request that fetches them.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { familyOf, googleFontsHref, themeFamilies, themeFontsHref } from '../src/theme/fonts';
import { parseTheme } from '../src/theme/parse';
import { emptyTheme } from '../src/theme/theme';

const bubblegum = parseTheme(readFileSync(fileURLToPath(new URL('./fixtures/tweakcn-bubblegum.css', import.meta.url)), 'utf8'));

describe('the family a stack is drawn with', () => {
  it('is the first entry, without its quotes', () => {
    expect(familyOf('Poppins, sans-serif')).toBe('Poppins');
    expect(familyOf('"Fira Code", monospace')).toBe('Fira Code');
    expect(familyOf("'IBM Plex Sans', ui-sans-serif, system-ui")).toBe('IBM Plex Sans');
  });

  it('is nothing for a family the site serves already', () => {
    expect(familyOf('Geist, sans-serif')).toBeNull();
    expect(familyOf("'Geist Variable', Geist, sans-serif")).toBeNull();
    expect(familyOf("'Outfit Variable', Outfit, 'Geist Variable', sans-serif")).toBeNull();
    expect(familyOf("'Open Sans Variable', 'Open Sans', sans-serif")).toBeNull();
    expect(familyOf("'Montserrat Variable', Montserrat, sans-serif")).toBeNull();
  });

  it('is nothing for a family the browser resolves on its own', () => {
    expect(familyOf('ui-sans-serif, system-ui, -apple-system, sans-serif')).toBeNull();
    expect(familyOf('monospace')).toBeNull();
    expect(familyOf('var(--font-sans)')).toBeNull();
    expect(familyOf('')).toBeNull();
  });
});

describe('the Google Fonts request', () => {
  it('asks for each family on its own, plain first and then with the weights the site uses', () => {
    // One request per family: Google refuses a whole request when any family in it lacks a
    // weight, and the plain request serves the regular face whatever weights the family has.
    expect(googleFontsHref(['Poppins', 'Lora', 'Poppins'])).toBe(
      [
        'https://fonts.googleapis.com/css2?family=Lora&display=swap',
        'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
        'https://fonts.googleapis.com/css2?family=Poppins&display=swap',
        'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
      ].join(' '),
    );
  });

  it('writes a two-word family with a plus', () => {
    expect(googleFontsHref(['Fira Code'])).toContain('family=Fira+Code:wght@400;500;600;700');
  });

  it('skips a family the machine serves, which Google Fonts does not carry', () => {
    expect(familyOf('Georgia, serif')).toBeNull();
    expect(familyOf("'Courier New', monospace")).toBeNull();
    expect(familyOf('Times New Roman, serif')).toBeNull();
    expect(googleFontsHref([])).toBeNull();
  });

  it('is nothing when a theme names no family to fetch', () => {
    expect(googleFontsHref([])).toBeNull();
    expect(themeFontsHref(emptyTheme())).toBeNull();
  });
});

describe('a pasted theme', () => {
  it('names the three families tweakcn exports', () => {
    expect(themeFamilies(bubblegum)).toEqual(['Poppins', 'Lora', 'Fira Code']);
  });

  it('asks for them one family at a time', () => {
    expect(themeFontsHref(bubblegum)?.split(' ')).toEqual([
      'https://fonts.googleapis.com/css2?family=Fira+Code&display=swap',
      'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap',
      'https://fonts.googleapis.com/css2?family=Lora&display=swap',
      'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
      'https://fonts.googleapis.com/css2?family=Poppins&display=swap',
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
    ]);
  });
});
