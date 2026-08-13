export const runtimeConfig = {
  useSampleData: process.env.NEXT_PUBLIC_USE_SAMPLE_DATA !== "false",
} as const;

export function usesSampleData(): boolean {
  return runtimeConfig.useSampleData;
}
