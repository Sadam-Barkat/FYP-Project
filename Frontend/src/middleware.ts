import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "access_token";
const ROLE_COOKIE = "userRole";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  const isLogin = pathname === "/login";
  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/doctor") ||
    pathname.startsWith("/nurse");

  // If user is authenticated and tries to access /login, redirect to their dashboard
  if (isLogin && token && role) {
    const url = request.nextUrl.clone();
    if (role === "admin") url.pathname = "/admin";
    else if (role === "doctor") url.pathname = "/doctor";
    else if (role === "nurse") url.pathname = "/nurse";
    else url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // If route is protected and there is no token, redirect to /login
  if (isProtectedRoute && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/doctor/:path*", "/nurse/:path*", "/login"],
};

