import { Edge } from 'reactflow';
import { CustomNode } from '../../types';

/**
 * Sanitizes a label string to be used as a variable name.
 * Removes all non-alphanumeric characters.
 */
export const sanitizeLabel = (label: string): string => label.replace(/[^a-zA-Z0-9]/g, '');

/**
 * Finds all ancestor nodes for a given node ID using Breadth-First Search (BFS).
 * This is used to determine which variables are available for substitution.
 */
export const findAncestors = (nodeId: string, nodes: CustomNode[], edges: Edge[]): CustomNode[] => {
    const ancestors = new Map<string, CustomNode>();
    const queue: string[] = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const incomingEdges = edges.filter(e => e.target === currentId);

        for (const edge of incomingEdges) {
            if (!visited.has(edge.source)) {
                const sourceNode = nodes.find(n => n.id === edge.source);
                if (sourceNode) {
                    ancestors.set(sourceNode.id, sourceNode);
                    queue.push(sourceNode.id);
                }
            }
        }
    }
    return Array.from(ancestors.values());
};

/**
 * Helper to safely access nested properties of an object using a string path.
 * @param obj The object to query.
 * @param path The path to the property (e.g., 'user.name').
 * @param defaultValue The value to return if the path is not found.
 */
const get = (obj: any, path: string, defaultValue: any = undefined) => {
    const travel = (regexp: RegExp) =>
      String.prototype.split
        .call(path, regexp)
        .filter(Boolean)
        .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
    return result === undefined || result === obj ? defaultValue : result;
};

/**
 * Recursively flattens an object to create an array of dot-notation paths.
 * @param obj The object to flatten.
 * @param prefix Internal use for recursion.
 */
const flattenObject = (obj: any, prefix = ''): string[] => {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj).reduce((acc: string[], k: string) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
            acc.push(...flattenObject(obj[k], pre + k));
        } else {
            acc.push(pre + k);
        }
        return acc;
    }, []);
};

/**
 * Generates a list of available global variable paths from the globals object.
 * @param globals The parsed global variables JSON object.
 */
export const getAvailableGlobalVariables = (globals: Record<string, any>): string[] => {
    return flattenObject(globals).map(path => `global.${path}`);
};

/**
 * Substitutes both local (from ancestors) and global variables in a given string.
 * @param text The text containing variables (e.g., 'Hello $name and $global.user.name').
 * @param localVars A map of local variable names to their values.
 * @param globalVars The parsed global variables JSON object.
 */
export const substituteVariables = (
  text: string,
  localVars: Record<string, string>,
  globalVars: Record<string, any>
): string => {
  if (!text) return '';
  return text.replace(/\$((?:global\.)?[\w.]+)/g, (match, varPath) => {
    if (varPath.startsWith('global.')) {
      const globalVarPath = varPath.substring('global.'.length);
      const value = get(globalVars, globalVarPath);
      // Only substitute primitives to avoid injecting [object Object]
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      return match;
    } else {
      return localVars[varPath] || match;
    }
  });
};
