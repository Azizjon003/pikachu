import fs from "fs";
import { exportPPTX } from "./main";

const json = fs.readFileSync("test-java.json", "utf-8");

const data = JSON.parse(json);

exportPPTX(data.slide, false, false, data.theme);
