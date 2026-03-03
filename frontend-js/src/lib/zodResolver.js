/**
 * @typedef {{ type: string; message: string }} RHFError
 */

/**
 * @param {Record<string, unknown>} target
 * @param {string[]} path
 * @param {RHFError} error
 */
function setNestedError(target, path, error) {
  let cursor = target;

  for (let index = 0; index < path.length; index++) {
    const key = path[index];
    const isLeaf = index === path.length - 1;

    if (isLeaf) {
      if (!(key in cursor)) {
        cursor[key] = error;
      }

      return;
    }

    const next = cursor[key];

    if (!next || typeof next !== "object") {
      cursor[key] = {};
    }

    cursor = cursor[key];
  }
}

/**
 * @param {import("zod").ZodTypeAny} schema
 * @returns {import("react-hook-form").Resolver<any>}
 */
export function zodResolver(schema) {
  return async (values) => {
    const parsed = schema.safeParse(values);

    if (parsed.success) {
      return {
        values: parsed.data,
        errors: {},
      };
    }

    /** @type {Record<string, unknown>} */
    const errors = {};

    for (const issue of parsed.error.issues) {
      const path = issue.path.map(String);

      if (path.length === 0) continue;
      setNestedError(errors, path, {
        type: issue.code,
        message: issue.message,
      });
    }

    return {
      values: {},
      errors: errors,
    };
  };
}
