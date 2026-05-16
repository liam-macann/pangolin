import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
	// Cookie eval quicker than accessing headers
	const sessionCookie = getSessionCookie(request);

	// Optimistically redirect users if they are not logged in
	// Auth checks must still be handled in each page/route
	if (!sessionCookie) {
		return NextResponse.redirect(new URL('/auth/login', request.url));
	}
}

export const config = {
	// Specify the routes the middleware applies to
	matcher: ['/((?!auth/|_next/static|_next/image|favicon.ico).*)'],
};
