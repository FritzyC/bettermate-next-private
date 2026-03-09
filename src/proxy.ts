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

  // If we can't determine auth status from cookies, let request through.
  // Client-side guards handle unauthenticated users.
  if (!user) {
    return response
  }

  if (!pathname.startsWith("/onboarding")) {
    const { data: fingerprint } = await supabase
      .from("user_fingerprint")
      .select("onboarding_complete")
      .eq("id", user.id)
      .maybeSingle()

    // Only redirect if we got a row back AND it's explicitly false
    // If no row exists yet, let them through (they may be mid-onboarding)
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
