import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/manifest.json",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/setup",
  "/api/webhooks(.*)",
  "/api/setup",
  "/api/uploadthing",
  "/api/mkt/(.*)",    // Bridge Python → Neon: auth propia con X-API-Key
  "/api/metro/(.*)", // MiniMetro game bridge: auth propia con X-Metro-Key
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    return NextResponse.next();
  } catch (e) {
    // En desarrollo: si Clerk no es alcanzable pero hay CLERK_JWT_KEY configurado,
    // la verificación JWT ya ocurrió localmente — permitir el request.
    // lib/auth.ts maneja el fallback de currentUser() a DB.
    if (process.env.NODE_ENV === "development") {
      console.warn("[middleware] ⚠️  Clerk API sin conexión — permitiendo en dev");
      return NextResponse.next();
    }
    throw e;
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
