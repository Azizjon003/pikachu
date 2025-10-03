import { importPPTX } from "./json";
import fs from "fs";

const buffer = fs.readFileSync("PR-3.pptx");

const start = async () => {
  const slides = await importPPTX(buffer as unknown as ArrayBuffer, {
    cover: true,
  });

  fs.writeFileSync("Amir.json", JSON.stringify(slides, null, 2));
};

start();
