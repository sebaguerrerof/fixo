export function applicationStateLabel(state:string):string {
 return ({draft:"Borrador",submitted:"Enviada a revisión",needs_information:"Requiere antecedentes",approved:"Aprobada",rejected:"Rechazada",suspended:"Suspendida"} as Record<string,string>)[state]??"Estado por confirmar";
}
export function documentTypeLabel(type:string):string {
 return ({identity:"Identidad",certificate:"Certificado",license:"Licencia",other:"Otro"} as Record<string,string>)[type]??"Documento";
}
export function inspectionStateLabel(state:string):string {
 return ({quarantined:"En cuarentena",clean:"Inspeccionado",unsafe:"Contenido rechazado",error:"Inspección no disponible"} as Record<string,string>)[state]??"Pendiente";
}
export function documentReviewLabel(state:string):string {
 return ({pending:"Pendiente",approved:"Aprobado",rejected:"Rechazado"} as Record<string,string>)[state]??"Pendiente";
}
export function criterionKindLabel(kind:string):string {
 return ({legal:"Requisito legal confirmado",internal:"Criterio interno Fixo",optional:"Información opcional"} as Record<string,string>)[kind]??"Criterio de revisión";
}
export function professionalEventLabel(action:string):string {
 return ({profile_changed:"Antecedentes modificados",draft_saved:"Borrador guardado",document_uploaded:"Documento recibido",document_inspected:"Documento inspeccionado",document_reviewed:"Documento revisado",application_submitted:"Postulación enviada",application_decided:"Decisión registrada",requirement_versioned:"Requisito actualizado"} as Record<string,string>)[action]??"Evento registrado";
}
