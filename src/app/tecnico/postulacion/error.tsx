"use client";
export default function Error({reset}:{reset:()=>void}){return <section className="p-8"><h1 className="text-2xl font-bold">No pudimos cargar la postulación</h1><button className="mt-4 rounded-xl border p-3" onClick={reset}>Intentar nuevamente</button></section>;}
