import { JobList } from "@/components/jobs/job-list";
export default function Page(props: { readonly searchParams: Promise<{ page?: string; state?: string }> }) { return <JobList area="admin" {...props} />; }
