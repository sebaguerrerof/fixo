import { JobWorkspace } from "@/components/jobs/job-workspace";
export default function Page(props: { readonly params: Promise<{ id: string }> }) { return <JobWorkspace area="tecnico" {...props} />; }
