import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../../context.js';
import { getServices } from '../../core/services.js';
import {
  editStoryOutlineDocumentSchema,
  editStoryOutlineSectionSchema,
  generatePlotFromOutlineSchema,
  idParamSchema,
  saveStoryOutlineSchema,
} from '../../schemas/index.js';

export const novelStoryOutlineRouter = new Hono<AppContext>()
  // GET /api/novels/:id/story-outline/markdown
  .get('/:id/story-outline/markdown', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const markdown = await getServices(c).novel.getStoryOutline(id);
    return c.json({ markdown });
  })
  // PUT /api/novels/:id/story-outline/markdown
  .put(
    '/:id/story-outline/markdown',
    zValidator('param', idParamSchema),
    zValidator('json', saveStoryOutlineSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { markdown } = c.req.valid('json');
      const updated = await getServices(c).novel.saveStoryOutline(id, markdown);
      return c.json({ success: true, novel: updated });
    },
  )
  // POST /api/novels/:id/story-outline/edit-section
  .post(
    '/:id/story-outline/edit-section',
    zValidator('param', idParamSchema),
    zValidator('json', editStoryOutlineSectionSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const editedContent = await getServices(c).novel.editStoryOutlineSection(id, {
        activeSection: {
          category: body.category,
          name: body.name,
          content: body.content,
        },
        instruction: body.instruction,
        markdown: body.markdown,
        modelConfigId: body.modelConfigId,
      });
      return c.json({ content: editedContent });
    },
  )
  // POST /api/novels/:id/story-outline/edit-document
  .post(
    '/:id/story-outline/edit-document',
    zValidator('param', idParamSchema),
    zValidator('json', editStoryOutlineDocumentSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const editedDocument = await getServices(c).novel.editStoryOutlineDocument(id, {
        instruction: body.instruction,
        markdown: body.markdown,
        modelConfigId: body.modelConfigId,
      });
      return c.json({ markdown: editedDocument });
    },
  )
  // POST /api/novels/:id/story-outline/generate-plot
  .post(
    '/:id/story-outline/generate-plot',
    zValidator('param', idParamSchema),
    zValidator('json', generatePlotFromOutlineSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const result = await getServices(c).novel.generatePlotFromOutline(id, {
        storyOutline: body.storyOutline,
        modelConfigId: body.modelConfigId,
      });
      return c.json(result);
    },
  );
