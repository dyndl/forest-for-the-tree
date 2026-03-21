import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

export const dynamic = 'force-dynamic'

// GET /api/oura/auth — kick off Oura OAuth2 flow
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.redirect(new URL('/api/auth/signin', req.url))

  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const redirectUri = `${base}/api/oura/callback`

  // State encodes return destination + user email for CSRF check in callback
  const state = Buffer.from(JSON.stringify({
    email: session.user.email,
    return_to: new URL(req.url).searchParams.get('return_to') || '/onboarding',
  })).toString('base64url')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OURA_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'daily heartrate personal',
    state,
  })

  return Response.redirect(`https://cloud.ouraring.com/oauth/authorize?${params}`)
}
