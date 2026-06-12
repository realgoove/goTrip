import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? 'yun2030@gmail.com')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const email = profile?.email?.toLowerCase() ?? '';
      return allowed.includes(email);
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
};
