cd "/Users/fritzgeraldcharpentier/Projects/bettermate-next/bettermate"

cat > "src/app/api/invites/accept/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('missing_supabase_public_env');
  if (!key) throw new Error('missing_service_role_key');

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1) Body
    let body: { token?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const token = body?.token;
    if (!token || typeof token !== 'string' || token.trim().length < 8) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
    }

    // 2) Verify auth session (cookie-based)
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (sessionError || !userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // 3) Call RPC via service role
    const service = getServiceRoleClient();

    const { data, error: rpcError } = await service.rpc('accept_invite', {
      p_token: token.trim(),
      p_user_id: userId,
    });

    if (rpcError) {
      console.error('[api/invites/accept] rpcError:', rpcError);
      return NextResponse.json(
        { error: 'rpc_error', detail: rpcError.message },
        { status: 500 }
      );
    }

    // accept_invite returns jsonb like {ok:true, match_id:...} OR {error:'...'}
    if (data?.error) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        expired: 410,
        cancelled: 410,
        already_accepted: 409,
        cannot_accept_own_invite: 403,
        conflict_try_again: 409,
        invalid_token: 400,
      };
      return NextResponse.json(
        { error: data.error },
        { status: statusMap[data.error] ?? 400 }
      );
    }

    if (!data?.ok || !data?.match_id) {
      return NextResponse.json(
        { error: 'unexpected_response', detail: JSON.stringify(data ?? null) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      match_id: data.match_id,
      invite_id: data.invite_id ?? null,
      idempotent: data.idempotent ?? false,
    });
  } catch (e: any) {
    const msg =
      e?.message === 'missing_service_role_key'
        ? 'missing_service_role_key'
        : e?.message === 'missing_supabase_public_env'
        ? 'missing_supabase_public_env'
        : 'internal_error';

    return NextResponse.json(
      { error: msg, detail: e?.message ?? null },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
EOF
