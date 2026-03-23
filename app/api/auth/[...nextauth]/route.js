import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { supabaseAdmin } from '@/lib/supabase-admin'
export const dynamic = 'force-dynamic'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: [
            'openid', 'email', 'profile',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/tasks',
            'https://www.googleapis.com/auth/contacts.readonly', // read contacts + birthdays
            'https://www.googleapis.com/auth/contacts.other.readonly', // other contacts
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.accessTokenExpires =
          account.expires_at != null ? account.expires_at * 1000 : Date.now() + 3600 * 1000

        // Store tokens in Supabase so cron job can use them (never fail sign-in if DB errors)
        if (token.email) {
          try {
            await supabaseAdmin.from('user_tokens').upsert({
              user_id: token.email,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
          } catch (e) {
            console.error('user_tokens upsert', e)
          }
        }
      }
      if (Date.now() < token.accessTokenExpires) return token
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.refreshToken = token.refreshToken
      session.error = token.error
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

async function refreshAccessToken(token) {
  try {
    const url = `https://oauth2.googleapis.com/token?${new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    })}`
    const res = await fetch(url, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw data

    if (token.email) {
      try {
        await supabaseAdmin.from('user_tokens').update({
          access_token: data.access_token,
          expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
          updated_at: new Date().toISOString(),
        }).eq('user_id', token.email)
      } catch (e) {
        console.error('user_tokens refresh update', e)
      }
    }

    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token ?? token.refreshToken,
    }
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
