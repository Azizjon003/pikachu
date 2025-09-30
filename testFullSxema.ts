import fs from "fs";
import { generateAISchema, generateSlideFromAI } from "./sxema";

const jsonFull = fs.readFileSync("Amir.json", "utf-8");

const dataFull = JSON.parse(jsonFull);

const jsonSxema = fs.readFileSync("Amir.sxema.json", "utf-8");
const dataSxema = JSON.parse(jsonSxema);

const dataFullSxema = generateSlideFromAI(dataSxema, dataFull);
fs.writeFileSync("Amir.fullSxema.json", JSON.stringify(dataFullSxema, null, 2));
