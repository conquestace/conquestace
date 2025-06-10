import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { wildcards, promptType } = await request.json();

    const fileCount = wildcards ? Object.keys(wildcards).length : 0;

    return new Response(
      JSON.stringify({
        prompt: `Generated prompt for ${fileCount} wildcard file(s) using ${promptType ?? 'default'} mode.`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ prompt: 'Error processing request.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
