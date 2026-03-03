/**
 * @typedef {import("./types").AccessControlManagedMenuRecord} AccessControlManagedMenuRecord
 */

/**
 * @typedef {Object} ManagedMenuTreeNode
 * @property {AccessControlManagedMenuRecord} menu
 * @property {ManagedMenuTreeNode[]} children
 */

/**
 * @typedef {Object} FlattenedManagedMenuRow
 * @property {AccessControlManagedMenuRecord} menu
 * @property {number} depth
 * @property {boolean} hasChildren
 */

/**
 * @param {AccessControlManagedMenuRecord} a
 * @param {AccessControlManagedMenuRecord} b
 * @returns {number}
 */
function sortMenus(a, b) {
  if (a.display_order !== b.display_order) {
    return a.display_order - b.display_order;
  }

  return a.id - b.id;
}

/**
 * @param {AccessControlManagedMenuRecord[]} menus
 * @returns {ManagedMenuTreeNode[]}
 */
export function buildManagedMenuTree(menus) {
  /** @type {Map<number, ManagedMenuTreeNode>} */
  const nodeMap = new Map();
  /** @type {ManagedMenuTreeNode[]} */
  const roots = [];
  const orderedMenus = [...menus].sort(sortMenus);

  for (const menu of orderedMenus) {
    nodeMap.set(menu.id, {
      menu,
      children: [],
    });
  }
  for (const menu of orderedMenus) {
    const node = nodeMap.get(menu.id);

    if (!node) continue;

    if (menu.parent_id !== null && nodeMap.has(menu.parent_id)) {
      nodeMap.get(menu.parent_id)?.children.push(node);
      continue;
    }

    roots.push(node);
  }

  return roots;
}

/**
 * @param {ManagedMenuTreeNode[]} tree
 * @param {Set<number>} matchIds
 * @returns {ManagedMenuTreeNode[]}
 */
export function filterManagedMenuTree(tree, matchIds) {
  /**
   * @param {ManagedMenuTreeNode[]} nodes
   * @returns {ManagedMenuTreeNode[]}
   */
  const prune = (nodes) => {
    /** @type {ManagedMenuTreeNode[]} */
    const kept = [];

    for (const node of nodes) {
      const filteredChildren = prune(node.children);

      if (matchIds.has(node.menu.id) || filteredChildren.length > 0) {
        kept.push({
          menu: node.menu,
          children: filteredChildren,
        });
      }
    }

    return kept;
  };

  return prune(tree);
}

/**
 * @param {ManagedMenuTreeNode[]} tree
 * @returns {FlattenedManagedMenuRow[]}
 */
export function flattenManagedMenuTree(tree) {
  /** @type {FlattenedManagedMenuRow[]} */
  const rows = [];

  /**
   * @param {ManagedMenuTreeNode[]} nodes
   * @param {number} depth
   */
  const walk = (nodes, depth) => {
    for (const node of nodes) {
      rows.push({
        menu: node.menu,
        depth,
        hasChildren: node.children.length > 0,
      });
      walk(node.children, depth + 1);
    }
  };

  walk(tree, 0);

  return rows;
}

/**
 * @param {number} menuId
 * @param {ManagedMenuTreeNode[]} tree
 * @returns {number[]}
 */
export function collectDescendantMenuIds(menuId, tree) {
  /** @type {Map<number, ManagedMenuTreeNode>} */
  const nodeMap = new Map();

  /** @param {ManagedMenuTreeNode[]} nodes */
  const indexTree = (nodes) => {
    for (const node of nodes) {
      nodeMap.set(node.menu.id, node);
      indexTree(node.children);
    }
  };

  indexTree(tree);
  /** @type {number[]} */
  const descendants = [];
  const root = nodeMap.get(menuId);

  if (!root) return descendants;
  const stack = [...root.children];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) continue;
    descendants.push(current.menu.id);
    stack.push(...current.children);
  }

  return descendants;
}
