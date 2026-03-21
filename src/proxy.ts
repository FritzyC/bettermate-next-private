import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/auth",
  "/invite",
  "/api",
  "/_next",
  "/favicon",
  "/admin",
  "/onboarding",
  "/login",
  "/signup",
  "/loging",
  "/request-access",
  "/how-it-works",
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auth is handled client-side via useOnboardingGuard and page-level checks
  if (!user) {
    return response
  }

  // Check invite gate — user must have an accepted invite OR be an admin
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
  const isAdmin = adminEmails.includes((user.email ?? "").toLowerCase())

  if (!isAdmin) {
    const { data: acceptedInvite } = await supabase
      .from("invites")
      .select("id")
      .eq("accepted_by_user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle()

    if (!acceptedInvite) {
      return NextResponse.redirect(new URL("/request-access", request.url))
    }
  }

  if (!pathname.startsWith("/onboarding")) {
    const { data: fingerprint } = await supabase
      .from("user_fingerprint")
      .select("onboarding_complete")
      .eq("id", user.id)
      .maybeSingle()

    const onboardingComplete = fingerprint?.onboarding_complete === true
    const hasRow = fingerprint !== null

    if (hasRow && !onboardingComplete) {
      return NextResponse.redirect(new URL("/onboarding", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)).*)",
  ],
}
