import { importPPTX } from "./json";
import fs from "fs";

const buffer = fs.readFileSync("Amir.pptx");

const start = async () => {
  // ⚠️ Hack: buffer’ni FileList sifatida cast qilamiz
  const slides = await importPPTX(buffer as unknown as ArrayBuffer, {
    cover: true,
  });

  fs.writeFileSync("Amir.json", JSON.stringify(slides, null, 2));
};

start();
