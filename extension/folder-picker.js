import { filterFolderTree } from "./popup-utils.js";

function highlight(text, query) {
  const fragment = document.createDocumentFragment();
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  if (index < 0) {
    fragment.append(text);
    return fragment;
  }
  const mark = document.createElement("mark");
  mark.textContent = text.slice(index, index + query.length);
  fragment.append(text.slice(0, index), mark, text.slice(index + query.length));
  return fragment;
}

export function createFolderPicker(root, { onChange } = {}) {
  const toggle = root.querySelector(".folder-picker-toggle");
  const parentLabel = root.querySelector(".folder-picker-parent");
  const titleLabel = root.querySelector(".folder-picker-title");
  const panel = root.querySelector(".folder-picker-panel");
  const search = root.querySelector(".folder-search");
  const list = root.querySelector(".folder-tree");

  let tree = [];
  let value = "";
  let activeId = "";
  let rows = [];
  const byId = new Map();
  const parentOf = new Map();
  const expanded = new Set();

  const isOpen = () => !panel.hidden;
  const query = () => search.value.trim();

  function index(nodes, parentId = "") {
    for (const node of nodes) {
      byId.set(node.id, node);
      parentOf.set(node.id, parentId);
      index(node.children, node.id);
    }
  }

  function expandAncestors(id) {
    for (let parentId = parentOf.get(id); parentId; parentId = parentOf.get(parentId)) {
      expanded.add(parentId);
    }
  }

  function updateLabel() {
    const node = byId.get(value);
    const parentId = parentOf.get(value);
    titleLabel.textContent = node ? node.title : "폴더를 선택하세요";
    parentLabel.textContent = parentId ? `${byId.get(parentId).path} /` : "";
  }

  function collectRows() {
    const filtering = Boolean(query());
    const result = [];
    const walk = (nodes, depth) => {
      for (const node of nodes) {
        const hasChildren = node.children.length > 0;
        const open = hasChildren && (filtering || expanded.has(node.id));
        result.push({ node, depth, hasChildren, open });
        if (open) walk(node.children, depth + 1);
      }
    };
    walk(filtering ? filterFolderTree(tree, query()) : tree, 0);
    return result;
  }

  function scrollToActive() {
    document.getElementById(`${root.id}-row-${activeId}`)?.scrollIntoView({ block: "nearest" });
  }

  function render() {
    const filtering = Boolean(query());
    rows = collectRows();
    if (!rows.some((row) => row.node.id === activeId)) {
      activeId = (filtering && rows.find((row) => row.node.matches)?.node.id) || rows[0]?.node.id || "";
    }
    list.replaceChildren();
    if (rows.length === 0) {
      const empty = document.createElement("li");
      empty.className = "folder-empty";
      empty.textContent = "일치하는 폴더가 없어요";
      list.append(empty);
    }
    for (const { node, depth, hasChildren, open } of rows) {
      const item = document.createElement("li");
      item.id = `${root.id}-row-${node.id}`;
      item.className = "folder-row";
      item.dataset.folderId = node.id;
      item.setAttribute("role", "treeitem");
      item.setAttribute("aria-level", String(depth + 1));
      item.setAttribute("aria-selected", String(node.id === value));
      if (hasChildren) item.setAttribute("aria-expanded", String(open));
      item.classList.toggle("selected", node.id === value);
      item.classList.toggle("active", node.id === activeId);
      item.classList.toggle("dimmed", filtering && !node.matches);
      item.style.setProperty("--depth", String(depth));

      const caret = document.createElement("span");
      caret.className = "folder-caret";
      if (hasChildren && !filtering) {
        caret.dataset.action = "toggle";
        caret.textContent = "›";
        caret.classList.toggle("open", open);
      }
      const icon = document.createElement("span");
      icon.className = `folder-glyph${open ? " open" : ""}`;
      icon.setAttribute("aria-hidden", "true");
      const title = document.createElement("span");
      title.className = "folder-title";
      title.append(highlight(node.title, filtering && node.matches ? query() : ""));
      const check = document.createElement("span");
      check.className = "folder-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = node.id === value ? "✓" : "";
      item.append(caret, icon, title, check);
      list.append(item);
    }
    if (activeId) list.setAttribute("aria-activedescendant", `${root.id}-row-${activeId}`);
    else list.removeAttribute("aria-activedescendant");
  }

  function setActive(id) {
    if (!id) return;
    activeId = id;
    render();
    scrollToActive();
  }

  function setExpanded(id, open) {
    if (open) expanded.add(id);
    else expanded.delete(id);
    render();
  }

  function open() {
    if (toggle.disabled) return;
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    search.value = "";
    expandAncestors(value);
    activeId = value;
    render();
    scrollToActive();
    search.focus();
  }

  function close({ focusToggle = false } = {}) {
    if (!isOpen()) return;
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (focusToggle) toggle.focus();
  }

  function setValue(id) {
    value = byId.has(id) ? id : "";
    expandAncestors(value);
    updateLabel();
    if (isOpen()) render();
  }

  function choose(id) {
    if (!byId.has(id)) return;
    setValue(id);
    close({ focusToggle: true });
    onChange?.(id);
  }

  function handleTreeKey(event) {
    const position = rows.findIndex((row) => row.node.id === activeId);
    const row = rows[position];
    const filtering = Boolean(query());
    switch (event.key) {
      case "ArrowDown":
        setActive(rows[Math.min(position + 1, rows.length - 1)]?.node.id);
        break;
      case "ArrowUp":
        if (position <= 0) search.focus();
        else setActive(rows[position - 1]?.node.id);
        break;
      case "Home":
        setActive(rows[0]?.node.id);
        break;
      case "End":
        setActive(rows.at(-1)?.node.id);
        break;
      case "ArrowRight":
        if (!row?.hasChildren || filtering) return;
        if (row.open) setActive(rows[position + 1]?.node.id);
        else setExpanded(row.node.id, true);
        break;
      case "ArrowLeft":
        if (!row || filtering) return;
        if (row.open) setExpanded(row.node.id, false);
        else setActive(parentOf.get(row.node.id));
        break;
      case "Enter":
      case " ":
        choose(activeId);
        break;
      case "Escape":
        close({ focusToggle: true });
        break;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          search.focus();
        }
        return;
    }
    event.preventDefault();
  }

  toggle.addEventListener("click", () => (isOpen() ? close() : open()));

  search.addEventListener("input", () => {
    activeId = "";
    render();
    scrollToActive();
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      list.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(activeId);
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (search.value) {
        search.value = "";
        render();
      } else {
        close({ focusToggle: true });
      }
    }
  });

  list.addEventListener("keydown", handleTreeKey);
  list.addEventListener("click", (event) => {
    const item = event.target.closest(".folder-row");
    if (!item) return;
    const id = item.dataset.folderId;
    if (event.target.closest("[data-action='toggle']")) {
      activeId = id;
      setExpanded(id, !expanded.has(id));
    } else {
      choose(id);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (isOpen() && !root.contains(event.target)) close();
  });

  return {
    get value() {
      return value;
    },
    get selected() {
      return byId.get(value) || null;
    },
    setValue,
    setTree(nextTree) {
      tree = nextTree;
      byId.clear();
      parentOf.clear();
      index(tree);
      if (expanded.size === 0) tree.forEach((node) => expanded.add(node.id));
      setValue(value);
    },
    setDisabled(disabled) {
      toggle.disabled = disabled;
      if (disabled) close();
    },
  };
}
