import fs from "fs";
import { exportPPTX } from "../core/exporters/pptx-exporter";

const json = fs.readFileSync("Amir.fullSxema.json", "utf-8");

const data = JSON.parse(json);

exportPPTX(data.slide, false, false, data.theme, {
  width: data.viewportWidth,
  height: data.viewportHeight,
});
