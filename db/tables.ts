/**
 * Script Formatter - format scripts to industry standards.
 *
 * Design goals:
 * - Scripts can be film, TV, short, etc.
 * - Store raw script content plus structured "elements" for future formatter improvements.
 * - Keep importable/exportable versions (e.g. final vs working draft).
 */

import { defineTable, column, NOW } from "astro:db";

export const Scripts = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    title: column.text(),
    scriptType: column.text({ optional: true }),      // "feature-film", "short-film", "tv-episode", etc.
    formatStandard: column.text({ optional: true }),  // "screenplay", "stageplay"
    logline: column.text({ optional: true }),
    status: column.text({ optional: true }),          // "idea", "draft", "polishing", "final"
    notes: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const ScriptVersions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    scriptId: column.text({
      references: () => Scripts.columns.id,
    }),
    versionLabel: column.text({ optional: true }),    // "v1", "v2", "Shooting Draft"
    isPreferred: column.boolean({ default: false }),
    rawContent: column.text(),                        // full script text
    formattedContent: column.text({ optional: true }),// cached formatted result
    createdAt: column.date({ default: NOW }),
  },
});

export const ScriptElements = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    scriptVersionId: column.text({
      references: () => ScriptVersions.columns.id,
    }),
    orderIndex: column.number(),                      // line/block order
    elementType: column.text(),                       // "scene-heading", "action", "dialogue", "parenthetical", etc.
    characterName: column.text({ optional: true }),   // for dialogue
    content: column.text(),                           // text of that element
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  Scripts,
  ScriptVersions,
  ScriptElements,
} as const;
