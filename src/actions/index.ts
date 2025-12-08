import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  ScriptElements,
  ScriptVersions,
  Scripts,
  and,
  db,
  eq,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedScript(scriptId: string, userId: string) {
  const [script] = await db
    .select()
    .from(Scripts)
    .where(and(eq(Scripts.id, scriptId), eq(Scripts.userId, userId)));

  if (!script) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Script not found.",
    });
  }

  return script;
}

async function getOwnedVersion(versionId: string, scriptId: string, userId: string) {
  await getOwnedScript(scriptId, userId);

  const [version] = await db
    .select()
    .from(ScriptVersions)
    .where(
      and(eq(ScriptVersions.id, versionId), eq(ScriptVersions.scriptId, scriptId))
    );

  if (!version) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Script version not found.",
    });
  }

  return version;
}

export const server = {
  createScript: defineAction({
    input: z.object({
      title: z.string().min(1),
      scriptType: z.string().optional(),
      formatStandard: z.string().optional(),
      logline: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [script] = await db
        .insert(Scripts)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          title: input.title,
          scriptType: input.scriptType,
          formatStandard: input.formatStandard,
          logline: input.logline,
          status: input.status,
          notes: input.notes,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { script } };
    },
  }),

  updateScript: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1).optional(),
        scriptType: z.string().optional(),
        formatStandard: z.string().optional(),
        logline: z.string().optional(),
        status: z.string().optional(),
        notes: z.string().optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.scriptType !== undefined ||
          input.formatStandard !== undefined ||
          input.logline !== undefined ||
          input.status !== undefined ||
          input.notes !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedScript(input.id, user.id);

      const [script] = await db
        .update(Scripts)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.scriptType !== undefined ? { scriptType: input.scriptType } : {}),
          ...(input.formatStandard !== undefined ? { formatStandard: input.formatStandard } : {}),
          ...(input.logline !== undefined ? { logline: input.logline } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Scripts.id, input.id))
        .returning();

      return { success: true, data: { script } };
    },
  }),

  listScripts: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const scripts = await db
        .select()
        .from(Scripts)
        .where(eq(Scripts.userId, user.id));

      return { success: true, data: { items: scripts, total: scripts.length } };
    },
  }),

  createScriptVersion: defineAction({
    input: z.object({
      scriptId: z.string().min(1),
      versionLabel: z.string().optional(),
      isPreferred: z.boolean().optional(),
      rawContent: z.string().min(1),
      formattedContent: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedScript(input.scriptId, user.id);

      const [version] = await db
        .insert(ScriptVersions)
        .values({
          id: crypto.randomUUID(),
          scriptId: input.scriptId,
          versionLabel: input.versionLabel,
          isPreferred: input.isPreferred ?? false,
          rawContent: input.rawContent,
          formattedContent: input.formattedContent,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { version } };
    },
  }),

  updateScriptVersion: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        scriptId: z.string().min(1),
        versionLabel: z.string().optional(),
        isPreferred: z.boolean().optional(),
        rawContent: z.string().optional(),
        formattedContent: z.string().optional(),
      })
      .refine(
        (input) =>
          input.versionLabel !== undefined ||
          input.isPreferred !== undefined ||
          input.rawContent !== undefined ||
          input.formattedContent !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedVersion(input.id, input.scriptId, user.id);

      const [version] = await db
        .update(ScriptVersions)
        .set({
          ...(input.versionLabel !== undefined ? { versionLabel: input.versionLabel } : {}),
          ...(input.isPreferred !== undefined ? { isPreferred: input.isPreferred } : {}),
          ...(input.rawContent !== undefined ? { rawContent: input.rawContent } : {}),
          ...(input.formattedContent !== undefined
            ? { formattedContent: input.formattedContent }
            : {}),
        })
        .where(eq(ScriptVersions.id, input.id))
        .returning();

      return { success: true, data: { version } };
    },
  }),

  deleteScriptVersion: defineAction({
    input: z.object({
      id: z.string().min(1),
      scriptId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedVersion(input.id, input.scriptId, user.id);

      const result = await db
        .delete(ScriptVersions)
        .where(eq(ScriptVersions.id, input.id));

      if (result.rowsAffected === 0) {
        throw new ActionError({ code: "NOT_FOUND", message: "Script version not found." });
      }

      return { success: true };
    },
  }),

  listScriptVersions: defineAction({
    input: z.object({
      scriptId: z.string().min(1),
      preferredOnly: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedScript(input.scriptId, user.id);

      const versions = await db
        .select()
        .from(ScriptVersions)
        .where(
          input.preferredOnly
            ? and(
                eq(ScriptVersions.scriptId, input.scriptId),
                eq(ScriptVersions.isPreferred, true)
              )
            : eq(ScriptVersions.scriptId, input.scriptId)
        );

      return { success: true, data: { items: versions, total: versions.length } };
    },
  }),

  createScriptElement: defineAction({
    input: z.object({
      scriptId: z.string().min(1),
      scriptVersionId: z.string().min(1),
      orderIndex: z.number().int(),
      elementType: z.string().min(1),
      characterName: z.string().optional(),
      content: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedVersion(input.scriptVersionId, input.scriptId, user.id);

      const [element] = await db
        .insert(ScriptElements)
        .values({
          id: crypto.randomUUID(),
          scriptVersionId: input.scriptVersionId,
          orderIndex: input.orderIndex,
          elementType: input.elementType,
          characterName: input.characterName,
          content: input.content,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { element } };
    },
  }),

  updateScriptElement: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        scriptId: z.string().min(1),
        scriptVersionId: z.string().min(1),
        orderIndex: z.number().int().optional(),
        elementType: z.string().optional(),
        characterName: z.string().optional(),
        content: z.string().optional(),
      })
      .refine(
        (input) =>
          input.orderIndex !== undefined ||
          input.elementType !== undefined ||
          input.characterName !== undefined ||
          input.content !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedVersion(input.scriptVersionId, input.scriptId, user.id);

      const [existing] = await db
        .select()
        .from(ScriptElements)
        .where(eq(ScriptElements.id, input.id));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Script element not found.",
        });
      }

      const [element] = await db
        .update(ScriptElements)
        .set({
          ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
          ...(input.elementType !== undefined ? { elementType: input.elementType } : {}),
          ...(input.characterName !== undefined ? { characterName: input.characterName } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
        })
        .where(eq(ScriptElements.id, input.id))
        .returning();

      return { success: true, data: { element } };
    },
  }),

  deleteScriptElement: defineAction({
    input: z.object({
      id: z.string().min(1),
      scriptId: z.string().min(1),
      scriptVersionId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedVersion(input.scriptVersionId, input.scriptId, user.id);

      const result = await db
        .delete(ScriptElements)
        .where(eq(ScriptElements.id, input.id));

      if (result.rowsAffected === 0) {
        throw new ActionError({ code: "NOT_FOUND", message: "Script element not found." });
      }

      return { success: true };
    },
  }),

  listScriptElements: defineAction({
    input: z.object({
      scriptId: z.string().min(1),
      scriptVersionId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedVersion(input.scriptVersionId, input.scriptId, user.id);

      const elements = await db
        .select()
        .from(ScriptElements)
        .where(eq(ScriptElements.scriptVersionId, input.scriptVersionId));

      return { success: true, data: { items: elements, total: elements.length } };
    },
  }),
};
