# Auth Middleware and Redirection Patterns

The application uses Next.js middleware with Supabase to handle authentication and route protection.

## Post-Login Redirection
To improve user experience, authenticated users are redirected to the most relevant functional area immediately after login.

- **Default Home**: `/availability` (instead of a generic `/dashboard`).
- **Redirect Rule**: If an authenticated user tries to access `/auth/*` pages (Login, Register), they are automatically redirected to `/availability`.

## Implementation in `middleware.ts`

```typescript
// If user is authenticated and trying to access auth pages
if (user && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/availability', request.url))
}
```

## Admin Route Protection
Routes starting with `/admin` are protected by a role check.

- **Check**: The `user_roles` table is queried to verify if the user has the `admin` role.
- **Fail Action**: Redirect to `/availability`.
