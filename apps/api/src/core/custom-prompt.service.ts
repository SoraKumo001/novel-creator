import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { customPrompts, type CustomPrompt, type NewCustomPrompt } from '@novel-creator/db';
import { assertFound, ValidationError, type ServiceContext } from './types.js';

export interface CreateCustomPromptInput {
  novelId?: string | null;
  name: string;
  description?: string | null;
  icon?: string | null;
  category?: 'inline' | 'generation' | 'chat' | 'general';
  systemPrompt?: string | null;
  userPrompt: string;
  order?: number;
}

export interface UpdateCustomPromptInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  category?: 'inline' | 'generation' | 'chat' | 'general';
  systemPrompt?: string | null;
  userPrompt?: string;
  order?: number;
}

const DEFAULT_PRESET_PROMPTS: Array<Omit<NewCustomPrompt, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    novelId: null,
    name: 'ハードボイルド調に変換',
    description: '無駄を削ぎ落とし、乾いた視点と渋みのあるモノローグで描写',
    icon: '🚬',
    category: 'inline',
    userPrompt: `以下の選択されたテキストを、ハードボイルド小説のような乾いたトーン、抑制された感情、五感を刺激する比喩を用いた渋い文体に書き換えてください。

{styleGuide}
{surroundingText}

■ 対象テキスト:
"""
{selectedText}
"""

書き換え後のテキストのみを出力してください:`,
    order: 1,
  },
  {
    novelId: null,
    name: '五感と環境音の肉付け',
    description: '光、匂い、風、背景音などの環境描写を緻密に加筆',
    icon: '🌧️',
    category: 'inline',
    userPrompt: `以下のシーンに、その場の「光の加減」「匂い」「気温・肌触り」「背後の環境音」など五感情報を豊かに盛り込んで情景描写を深めてください。

{styleGuide}
{characters}

■ 対象テキスト:
"""
{selectedText}
"""

書き換え後のテキストのみを出力してください:`,
    order: 2,
  },
  {
    novelId: null,
    name: '息詰まるサスペンス・緊張感',
    description: '鼓動や呼吸、間（ま）を強調して緊迫感を極限まで高める',
    icon: '⚡',
    category: 'inline',
    userPrompt: `以下のテキストの緊迫感を極限まで高めてください。短いセンテンス、登場人物の荒い呼吸や心拍、視線の動きを強調して読者の息を呑ませる描写に書き換えてください。

■ 対象テキスト:
"""
{selectedText}
"""

書き換え後のテキストのみを出力してください:`,
    order: 3,
  },
];

export class CustomPromptDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listPrompts(novelId?: string | null, category?: string) {
    const conditions = [];

    if (novelId) {
      // 特定小説用のプロンプト + 全体共通(novelId is null)の両方を取得
      conditions.push(or(eq(customPrompts.novelId, novelId), isNull(customPrompts.novelId)));
    } else {
      // novelId が指定されていない場合は全体共通のみ
      conditions.push(isNull(customPrompts.novelId));
    }

    if (category) {
      conditions.push(eq(customPrompts.category, category));
    }

    const rows = await this.ctx.db
      .select()
      .from(customPrompts)
      .where(and(...conditions))
      .orderBy(asc(customPrompts.order), desc(customPrompts.createdAt));

    // 初回利用時、共通プロンプトが1件も存在しない場合はプリセットを自動挿入
    if (rows.length === 0 && !novelId) {
      return this.seedDefaultPresets();
    }

    return rows;
  }

  async getPromptById(id: string) {
    const [row] = await this.ctx.db.select().from(customPrompts).where(eq(customPrompts.id, id));
    assertFound(row, 'Custom prompt not found');
    return row;
  }

  async createPrompt(input: CreateCustomPromptInput) {
    if (!input.name?.trim()) {
      throw new ValidationError('Prompt name is required');
    }
    if (!input.userPrompt?.trim()) {
      throw new ValidationError('User prompt template is required');
    }

    const [row] = await this.ctx.db
      .insert(customPrompts)
      .values({
        novelId: input.novelId ?? null,
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        icon: input.icon?.trim() || '🪄',
        category: input.category || 'inline',
        systemPrompt: input.systemPrompt?.trim() ?? null,
        userPrompt: input.userPrompt.trim(),
        order: input.order ?? 0,
      })
      .returning();

    return row;
  }

  async updatePrompt(id: string, input: UpdateCustomPromptInput) {
    const [existing] = await this.ctx.db
      .select()
      .from(customPrompts)
      .where(eq(customPrompts.id, id));
    assertFound(existing, 'Custom prompt not found');

    const updateData: Partial<NewCustomPrompt> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new ValidationError('Prompt name cannot be empty');
      updateData.name = input.name.trim();
    }
    if (input.description !== undefined) {
      updateData.description = input.description?.trim() ?? null;
    }
    if (input.icon !== undefined) {
      updateData.icon = input.icon?.trim() || '🪄';
    }
    if (input.category !== undefined) {
      updateData.category = input.category;
    }
    if (input.systemPrompt !== undefined) {
      updateData.systemPrompt = input.systemPrompt?.trim() ?? null;
    }
    if (input.userPrompt !== undefined) {
      if (!input.userPrompt.trim()) throw new ValidationError('User prompt cannot be empty');
      updateData.userPrompt = input.userPrompt.trim();
    }
    if (input.order !== undefined) {
      updateData.order = input.order;
    }

    const [row] = await this.ctx.db
      .update(customPrompts)
      .set(updateData)
      .where(eq(customPrompts.id, id))
      .returning();

    return row;
  }

  async deletePrompt(id: string) {
    const [row] = await this.ctx.db
      .delete(customPrompts)
      .where(eq(customPrompts.id, id))
      .returning();
    assertFound(row, 'Custom prompt not found');
    return row;
  }

  async seedDefaultPresets() {
    const created: CustomPrompt[] = [];
    for (const preset of DEFAULT_PRESET_PROMPTS) {
      const [row] = await this.ctx.db.insert(customPrompts).values(preset).returning();
      if (row) created.push(row);
    }
    return created;
  }
}
