export interface CharacterGraphNode {
  category?: string | null;
  id: string;
  name: string;
  relationships?: unknown;
}

/**
 * 人物一覧データから Mermaid 形式の人物相関図（LR方向のグラフ）を生成する
 */
export function generateCharacterMermaidGraph(
  characters: CharacterGraphNode[]
): string {
  if (characters.length === 0) {
    return "graph LR\n  empty[登場人物が登録されていません]";
  }

  const lines: string[] = ["graph LR"];
  const nameToId = new Map<string, string>();
  const idToSanitized = new Map<string, string>();

  // サニタイズIDを生成
  characters.forEach((char, index) => {
    const sanitizedId = `char_${index}`;
    nameToId.set(char.name.trim(), sanitizedId);
    idToSanitized.set(char.id, sanitizedId);
  });

  // カテゴリ（勢力・陣営）ごとにグルーピング
  const grouped = new Map<string, CharacterGraphNode[]>();
  for (const char of characters) {
    const category = char.category?.trim() || "その他";
    const list = grouped.get(category) ?? [];
    list.push(char);
    grouped.set(category, list);
  }

  // カテゴリごとの subgraph
  let subIndex = 0;
  for (const [category, members] of grouped.entries()) {
    lines.push(`  subgraph sub_${subIndex}["${category}"]`);
    for (const member of members) {
      const sId = idToSanitized.get(member.id)!;
      // ノード名を安全にエスケープ
      const escapedName = member.name.replace(/["[\]()]/g, "");
      lines.push(`    ${sId}["${escapedName}"]`);
    }
    lines.push("  end");
    subIndex++;
  }

  // リレーションシップ（関係線）を生成
  const addedEdges = new Set<string>();

  for (const char of characters) {
    const fromId = idToSanitized.get(char.id)!;
    const rels = char.relationships;

    if (typeof rels === "string" && rels.trim()) {
      // "田中: 友人\n佐藤: 敵対" のようなテキストをパース
      const relLines = rels.split("\n");
      for (const line of relLines) {
        const parts = line.split(/[:：]/);
        if (parts.length >= 2) {
          const targetName = parts[0].trim();
          const relationLabel = parts.slice(1).join(":").trim();
          const targetId = nameToId.get(targetName);

          if (targetId && targetId !== fromId) {
            const edgeKey = `${fromId}->${targetId}:${relationLabel}`;
            if (!addedEdges.has(edgeKey)) {
              addedEdges.add(edgeKey);
              const safeLabel = relationLabel.replace(/["[\]()]/g, "");
              lines.push(`  ${fromId} -->|"${safeLabel}"| ${targetId}`);
            }
          }
        }
      }
    } else if (rels && typeof rels === "object" && !Array.isArray(rels)) {
      // { "佐藤": "敵対", "char_id": "友人" } のようなオブジェクトをパース
      for (const [targetKey, label] of Object.entries(
        rels as Record<string, unknown>
      )) {
        const targetId =
          nameToId.get(targetKey.trim()) || idToSanitized.get(targetKey.trim());
        if (targetId && targetId !== fromId && typeof label === "string") {
          const edgeKey = `${fromId}->${targetId}:${label}`;
          if (!addedEdges.has(edgeKey)) {
            addedEdges.add(edgeKey);
            const safeLabel = label.replace(/["[\]()]/g, "");
            lines.push(`  ${fromId} -->|"${safeLabel}"| ${targetId}`);
          }
        }
      }
    }
  }

  return lines.join("\n");
}
