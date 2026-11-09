export function inspectContent(bytes:Buffer):Promise<"application/pdf"|"image/png"|"image/jpeg">;
export function inspectDocument(bytes:Buffer,declaredMime:string):Promise<{sha256:string;mime:string|null;size:number;result:"clean"|"unsafe"|"error";engine:string}>;
