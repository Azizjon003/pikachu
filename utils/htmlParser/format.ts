import type {
  HTMLNode,
  CommentOrTextAST,
  ElementAST,
  AST,
  ElementAttribute,
} from "./types.js";

export const splitHead = (str: string, sep: string) => {
  const idx = str.indexOf(sep);
  if (idx === -1) return [str];
  return [str.slice(0, idx), str.slice(idx + sep.length)];
};

const unquote = (str: string) => {
  const car = str.charAt(0);
  const end = str.length - 1;
  const isQuoteStart = car === '"' || car === "'";
  if (isQuoteStart && car === str.charAt(end)) {
    return str.slice(1, end);
  }
  return str;
};

const formatAttributes = (attributes: string[]) => {
  return attributes.reduce((acc: ElementAttribute[], attribute) => {
    const parts = splitHead(attribute.trim(), "=");
    const key = parts[0];
    if (key) {
      const value = typeof parts[1] === "string" ? unquote(parts[1]) : null;
      acc.push({ key, value });
    }
    return acc;
  }, []);
};

export const format = (nodes: HTMLNode[]): AST[] => {
  return nodes.map((node) => {
    if (node.type === "element") {
      const children = format(node.children);
      const item: ElementAST = {
        type: "element",
        tagName: node.tagName.toLowerCase(),
        attributes: formatAttributes(node.attributes),
        children,
      };
      return item;
    }

    const item: CommentOrTextAST = {
      type: node.type,
      content: node.content,
    };
    return item;
  });
};
