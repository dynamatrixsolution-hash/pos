import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const { email, password } = parsedCredentials.data;

        // Query active user
        const user = await db.user.findUnique({
          where: { email },
          include: {
            business: {
              include: {
                subscription: true,
              },
            },
          },
        });

        if (!user || !user.isActive || user.deletedAt) {
          return null;
        }

        // Verify if subscription exists and is active/valid
        const subscription = user.business.subscription;
        if (!subscription || subscription.status !== "ACTIVE") {
          // You could allow subscription panel access or login blocks
          // For now, let them log in, but middleware will restrict access
        }

        // Verify password hash
        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordsMatch) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: user.businessId,
          branchId: user.branchId,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (user) {
        try {
          await db.auditLog.create({
            data: {
              businessId: (user as any).businessId,
              userId: user.id,
              role: (user as any).role || "CASHIER",
              action: "LOGIN",
              module: "USER",
              details: `User ${user.name || user.email} logged in successfully.`,
            },
          });
        } catch (err) {
          console.error("Error logging signIn event:", err);
        }
      }
    },
    async signOut(message) {
      const token = (message as any).token;
      if (token) {
        try {
          await db.auditLog.create({
            data: {
              businessId: token.businessId as string,
              userId: (token.id as string) || (token.sub as string),
              role: (token.role as string) || "CASHIER",
              action: "LOGOUT",
              module: "USER",
              details: `User ${token.name || token.email || "Unknown"} logged out.`,
            },
          });
        } catch (err) {
          console.error("Error logging signOut event:", err);
        }
      }
    }
  }
});
