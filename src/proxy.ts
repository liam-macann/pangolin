import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
	// Cookie evaluation is quicker than accessing DB session
	const sessionCookie = getSessionCookie(request, { cookiePrefix: 'pangolin' });

	// Optimistically redirect users if they are not logged in
	// Auth checks must still be handled in each page/route
	if (!sessionCookie) return NextResponse.redirect(new URL('/auth/login', request.url));

	return NextResponse.next();
}

export const config = {
	// Specify the routes the middleware applies to
	matcher: ['/', '/settings/:path*', '/invoices/:path*', '/clients/:path*'],
};
