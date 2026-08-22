export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/wines?select=id&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return new Response(`Supabase ping failed: ${res.status} ${text}`, { status: 500 });
    }

    return new Response(`Pinged Supabase successfully at ${new Date().toISOString()}`, { status: 200 });
  } catch (error) {
    return new Response(`Error pinging Supabase: ${error.message}`, { status: 500 });
  }
}
