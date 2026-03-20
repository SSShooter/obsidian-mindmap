import * as mindElixirI18n from "mind-elixir/i18n";

export async function getMindElixirLocale(): Promise<mindElixirI18n.LangPack> {
  const configs = await logseq.App.getUserConfigs();
  const obLocale = configs.preferredLanguage.toLowerCase();
  
  if (obLocale === "zh-cn") return mindElixirI18n.zh_CN;
  if (obLocale === "zh-tw" || obLocale === "zh-hk") return mindElixirI18n.zh_TW;
  
  const key = obLocale.replace(/-/g, "_");
  if (Object.prototype.hasOwnProperty.call(mindElixirI18n, key)) {
    const langPack = (mindElixirI18n as Record<string, mindElixirI18n.LangPack>)[key];
    if (langPack) return langPack;
  }
  
  return mindElixirI18n.en;
}
