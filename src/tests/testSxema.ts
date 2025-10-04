import fs from "fs";
import { generateAISchema } from "../core/processors/schema-processor";

const json = fs.readFileSync("Amir.json", "utf-8");

const data = JSON.parse(json);
const sxema = generateAISchema(data.slide);
fs.writeFileSync("Amir.sxema.json", JSON.stringify(sxema, null, 2));
