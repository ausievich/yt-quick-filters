import { FilterCombineMode } from '../types';

/**
 * Builds and inspects board queries that combine several quick filters with `and` or `or`.
 * Only an explicit top-level operator separates clauses; anything inside quotes, braces
 * or parentheses is kept intact.
 */

type Operator = FilterCombineMode;

export function normalizeQuery(query: string): string {
  return query
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isOperatorBoundary(char: string | undefined): boolean {
  return char === undefined || /[\s()]/.test(char);
}

function isOperatorAt(query: string, index: number, operator: Operator): boolean {
  return (
    query.slice(index, index + operator.length).toLowerCase() === operator &&
    isOperatorBoundary(query[index - 1]) &&
    isOperatorBoundary(query[index + operator.length])
  );
}

function splitTopLevel(query: string, operator: Operator): string[] {
  const parts: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let inBraces = false;
  let inQuotes = false;

  for (let index = 0; index < query.length; index += 1) {
    const char = query[index];

    if (inQuotes) {
      if (char === '"' && query[index - 1] !== '\\') inQuotes = false;
    } else if (inBraces) {
      if (char === '}') inBraces = false;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === '{') {
      inBraces = true;
    } else if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (parenDepth === 0 && isOperatorAt(query, index, operator)) {
      parts.push(query.slice(start, index).trim());
      start = index + operator.length;
      index = start - 1;
    }
  }

  parts.push(query.slice(start).trim());
  return parts;
}

// True when the whole query is one parenthesized group, e.g. `(a or b)` but not `(a) or (b)`.
function isWrapped(query: string): boolean {
  if (!query.startsWith('(') || !query.endsWith(')')) return false;

  let depth = 0;
  let inBraces = false;
  let inQuotes = false;

  for (let index = 0; index < query.length; index += 1) {
    const char = query[index];

    if (inQuotes) {
      if (char === '"' && query[index - 1] !== '\\') inQuotes = false;
    } else if (inBraces) {
      if (char === '}') inBraces = false;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === '{') {
      inBraces = true;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0 && index < query.length - 1) return false;
    }
  }

  return depth === 0;
}

function unwrap(query: string): string {
  let result = query.trim();
  while (isWrapped(result)) {
    result = result.slice(1, -1).trim();
  }
  return result;
}

function clauseKey(query: string): string {
  return normalizeQuery(unwrap(query));
}

/**
 * Splits a query into its top-level clauses for the given operator. When splitting
 * on `and`, a query with a top-level `or` stays a single clause, because `and`
 * binds tighter than `or`.
 */
export function splitClauses(query: string, operator: Operator): string[] {
  const unwrapped = unwrap(query);
  if (!unwrapped) return [];

  if (operator === 'and' && splitTopLevel(unwrapped, 'or').length > 1) return [unwrapped];

  return splitTopLevel(unwrapped, operator).map(unwrap).filter(Boolean);
}

export function combineQueries(queries: string[], operator: Operator): string {
  const clauses = queries.map(unwrap).filter(Boolean);
  if (clauses.length <= 1) return clauses[0] ?? '';
  return clauses.map((clause) => `(${clause})`).join(` ${operator} `);
}

export function isSameQuery(a: string, b: string): boolean {
  return clauseKey(a) === clauseKey(b);
}

/**
 * Returns the indices of filters applied by the query: an exact match wins,
 * otherwise every filter that matches one of the query's clauses.
 */
export function getActiveFilterIndices(
  filters: { query: string }[],
  query: string,
  operator: Operator,
): Set<number> {
  const queryKey = clauseKey(query);
  const active = new Set<number>();
  if (!queryKey) return active;

  const filterKeys = filters.map((filter) => clauseKey(filter.query));

  filterKeys.forEach((key, index) => {
    if (key === queryKey) active.add(index);
  });
  if (active.size > 0) return active;

  const clauseKeys = new Set(splitClauses(query, operator).map(clauseKey));
  filterKeys.forEach((key, index) => {
    if (key && clauseKeys.has(key)) active.add(index);
  });

  return active;
}

/**
 * Adds the filter to the query as an extra clause, or removes it if it is
 * already one of the clauses.
 */
export function toggleFilterInQuery(
  query: string,
  filterQuery: string,
  operator: Operator,
): string {
  const filterKey = clauseKey(filterQuery);
  if (!filterKey) return query.trim();
  if (clauseKey(query) === filterKey) return '';

  const clauses = splitClauses(query, operator);
  const remaining = clauses.filter((clause) => clauseKey(clause) !== filterKey);

  if (remaining.length < clauses.length) return combineQueries(remaining, operator);
  return combineQueries([...clauses, filterQuery], operator);
}
