// workers/index.ts
import "dotenv/config";
import "./enrichment";
import "./scoring";
import "./call-brief";
import "./retry";

console.log("Worker process started, listening for jobs...");
console.log("- enrichment queue: active");
console.log("- scoring queue: active");
console.log("- call-brief queue: active");
console.log("- retry-check queue: active (30-min sweep)");