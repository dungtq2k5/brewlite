/** The Vietnamese given name is the last word of the full name; a one-word name is used whole. */
export const givenName = (fullName: string): string => fullName.trim().split(/\s+/).at(-1) ?? '';
