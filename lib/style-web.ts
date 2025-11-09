/**
 * Helper to convert style arrays to objects for DOM elements
 * React Native primitives support style arrays, but DOM nodes do not.
 * Use this only when we cannot swap to RN primitives.
 */
export function toStyleObject(s: any): any {
  if (!s) return s;
  if (Array.isArray(s)) {
    return Object.assign({}, ...s.filter(Boolean));
  }
  return s;
}

