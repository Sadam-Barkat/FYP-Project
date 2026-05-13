import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "access_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/doctor") ||
    pathname.startsWith("/nurse") ||
    pathname.startsWith("/reception") ||
    pathname.startsWith("/laboratory-entry");

  if (isProtectedRoute && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
