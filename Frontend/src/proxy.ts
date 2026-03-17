import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "access_token";
const ROLE_COOKIE = "userRole";

// Next.js 16 proxy entry point (replacement for deprecated middleware.ts)
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  // Base URL: always redirect to login so "/" never 404s
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/doctor") ||
    pathname.startsWith("/nurse") ||
    pathname.startsWith("/reception") ||
    pathname.startsWith("/laboratory-entry");

  // If route is protected and there is no token, redirect to /login
  if (isProtectedRoute && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/doctor/:path*",
    "/nurse",
    "/nurse/:path*",
    "/reception",
    "/reception/:path*",
    "/laboratory-entry",
    "/laboratory-entry/:path*",
    "/login",
  ],
};

