// Replaces the /*@FONTS*/ marker in every frame with the shared @font-face block,
// so each sub-composition carries its own font faces (template transport rule).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const fonts = readFileSync(".hyperframes/fonts.css", "utf8");
for (const file of readdirSync("frames-src").filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(`frames-src/${file}`, "utf8").replace("/*@FONTS*/", fonts);
  writeFileSync(`compositions/frames/${file}`, html);
}
