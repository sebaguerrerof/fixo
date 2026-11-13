import { readdirSync,readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const rows=readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).map(file=>{
 const source=readFileSync("supabase/migrations/"+file,"utf8");
 const adapted=source.replace(/\bbegin;\s*/i,"").replace(/commit;\s*$/i,"").replace(/\r\n/g,"\n").trim();
 return{file,sourceSha256:createHash("sha256").update(source).digest("hex"),adaptedBodyMd5:createHash("md5").update(adapted).digest("hex")};
});
console.log(JSON.stringify(rows));
