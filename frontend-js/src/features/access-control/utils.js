/**
 * @typedef {import("./types").AccessControlMenuOption} AccessControlMenuOption
 */

/**
 * @typedef {Object} MenuTreeNode
 * @property {AccessControlMenuOption} menu
 * @property {MenuTreeNode[]} children
 */

/**
 * Build a tree from a flat menu array using parent_id relationships.
 * @param {AccessControlMenuOption[]} menus
 * @returns {MenuTreeNode[]}
 */
export function buildMenuTree(menus) {
  /** @type {Map<number, MenuTreeNode>} */
  const nodeMap = new Map();

  // First pass: create all nodes
  for (const menu of menus) {
    nodeMap.set(menu.id, { menu, children: [] });
  }

  // Second pass: wire children to parents
  /** @type {MenuTreeNode[]} */
  const roots = [];

  for (const menu of menus) {
    const node = nodeMap.get(menu.id);

    if (menu.parent_id !== null && nodeMap.has(menu.parent_id)) {
      nodeMap.get(menu.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Walk up the parent_id chain and return all ancestor IDs for a given menu.
 * @param {number} menuId
 * @param {AccessControlMenuOption[]} menus
 * @returns {number[]}
 */
export function getAncestorIds(menuId, menus) {
  /** @type {Map<number, AccessControlMenuOption>} */
  const byId = new Map();

  for (const m of menus) {
    byId.set(m.id, m);
  }

  /** @type {number[]} */
  const ancestors = [];
  let current = byId.get(menuId);

  while (current?.parent_id !== null && current?.parent_id !== undefined) {
    const parent = byId.get(current.parent_id);

    if (!parent) break;
    ancestors.push(parent.id);
    current = parent;
  }

  return ancestors;
}

/**
 * DFS from a node to collect all descendant IDs.
 * @param {number} menuId
 * @param {Map<number, MenuTreeNode>} nodeMap
 * @returns {number[]}
 */
export function getDescendantIds(menuId, nodeMap) {
  /** @type {number[]} */
  const descendants = [];
  const node = nodeMap.get(menuId);

  if (!node) return descendants;
  const stack = [...node.children];

  while (stack.length > 0) {
    const current = stack.pop();

    descendants.push(current.menu.id);
    stack.push(...current.children);
  }

  return descendants;
}

/**
 * Prune a full tree to only include branches that contain at least one
 * matching menu ID. Ancestors are kept for structural context.
 * @param {MenuTreeNode[]} tree
 * @param {Set<number>} matchIds
 * @returns {MenuTreeNode[]}
 */
export function buildFilteredTree(tree, matchIds) {
  /**
   * @param {MenuTreeNode[]} nodes
   * @returns {MenuTreeNode[]}
   */
  const prune = (nodes) => {
    /** @type {MenuTreeNode[]} */
    const kept = [];

    for (const node of nodes) {
      const filteredChildren = prune(node.children);

      if (matchIds.has(node.menu.id) || filteredChildren.length > 0) {
        kept.push({ menu: node.menu, children: filteredChildren });
      }
    }

    return kept;
  };

  return prune(tree);
}
