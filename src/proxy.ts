import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // Still run a timingSafeEqual of matching length so a length mismatch
    // doesn't return faster than a full comparison would.
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

function isAuthorized(request: NextRequest): boolean {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  // Fail closed: without configured credentials, nothing is served.
  if (!expectedUser || !expectedPassword) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  let decoded: string;
  try {
    decoded = atob(authHeader.slice("Basic ".length));
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return false;
  }

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  return safeCompare(user, expectedUser) && safeCompare(password, expectedPassword);
}

export default function proxy(request: NextRequest) {
  if (isAuthorized(request)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Stock Forecast App", charset="UTF-8"',
    },
  });
}

export const config = {
  // Protect every route, including all pages and API routes. The PWA
  // manifest, icons, and service worker script are deliberately excluded:
  // some browsers fetch the manifest/icons without credentials (per the Web
  // App Manifest spec), so gating them can silently break "Add to Home
  // Screen". None of these expose anything sensitive (just the app name,
  // icon, and generic caching logic) — actual pages, stock data, and the
  // forecast logic all stay behind Basic Auth. Next.js's own internal
  // static/image assets are excluded too, since the browser re-sends cached
  // Basic Auth credentials for them once the initial page request has been
  // authenticated.
  matcher: [
    "/((?!_next/static|_next/image|manifest\\.webmanifest|sw\\.js|icons/|icon$|apple-icon$).*)",
  ],
};
