import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin.user";

export const settingsSchema: SettingSchemaDesc[] = [
  {
    key: "h1AsRoot",
    type: "boolean",
    title: "Use first level 1 heading as root",
    description: "When enabled, uses the first level 1 heading as the root node instead of the page title. Content before the first level 1 heading will be ignored.",
    default: false,
  }
];
