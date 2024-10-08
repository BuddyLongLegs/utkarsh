import {
  type DefaultSession,
  getServerSession,
  type NextAuthOptions,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { db } from "~/server/db";
import { getStudentAviralData, verifyPassword } from "~/server/utils/aviral";
import { jwtHelper, tokenOneDay, tokenOnWeek } from "~/server/utils/jwtHelper";

declare module "next-auth" {
  interface User {
    id?: string;
    name?: string;
    username?: string;
    userGroup?: string;
    admin?: {
      permissions: number;
    };
    isOnboardingComplete: boolean;
    year?: number;
  }

  interface Session {
    user: {
      id?: string;
      name?: string;
      username?: string;
      userGroup?: string;
      admin?: {
        permissions: number;
      };
      isOnboardingComplete: boolean;
      year?: number;
    };
    error?: "RefreshAccessTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user: any;
    accessToken: string;
    refreshToken: string;
    accessTokenExpired: number;
    refreshTokenExpired: number;
    error?: "RefreshAccessTokenError";
  }
}

export const authOptions: NextAuthOptions = {
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // credentials provider:  Save the access token and refresh token in the JWT on the initial login
      if (user) {
        const authUser = { ...user };

        const accessToken = await jwtHelper.createAcessToken(authUser);
        const refreshToken = await jwtHelper.createRefreshToken(authUser);
        const accessTokenExpired = Date.now() / 1000 + tokenOneDay;
        const refreshTokenExpired = Date.now() / 1000 + tokenOnWeek;

        return {
          ...token,
          accessToken,
          refreshToken,
          accessTokenExpired,
          refreshTokenExpired,
          user: authUser,
        };
      } else {
        if (token) {
          // In subsequent requests, check access token has expired, try to refresh it
          if (Date.now() / 1000 > token.accessTokenExpired) {
            const verifyToken = await jwtHelper.verifyToken(token.refreshToken);

            if (verifyToken) {
              const user = await db.user.findFirst({
                where: {
                  id: token.user.id,
                },
              });

              if (user) {
                const accessToken = await jwtHelper.createAcessToken(
                  token.user,
                );
                const accessTokenExpired = Date.now() / 1000 + tokenOneDay;

                return { ...token, accessToken, accessTokenExpired };
              }
            }

            return { ...token, error: "RefreshAccessTokenError" };
          }
        }
      }

      if (trigger === "update") {
        if (session.info.year) {
          const user = await db.user.findFirst({
            where: {
              id: token.user.id,
            },
            select: {
              userGroup: true,
              admin: {
                select: {
                  permissions: true,
                },
              },
              student: {
                select: {
                  admissionYear: true,
                  program: true,
                },
              },
            },
          });
          if (!!user.admin) {
            const newUser = { ...token.user };
            newUser.year = session.info.year;
            return {
              ...token,
              user: newUser,
            };
          } else if (user.userGroup === "student") {
            const yearExists = await db.participatingGroups.findFirst({
              where: {
                year: session.info.year,
                admissionYear: user.student?.admissionYear || null,
                program: user.student?.program || null,
              },
            });
            if (yearExists) {
              const newUser = { ...token.user };
              newUser.year = session.info.year;
              return {
                ...token,
                user: newUser,
              };
            }
          }
        } else if (session.info.onboardingComplete) {
          const user = await db.user.findFirst({
            where: {
              id: token.user.id,
            },
            select: {
              student: {
                select: {
                  isOnboardingComplete: true,
                },
              },
            },
          });
          if (user.student && user.student.isOnboardingComplete) {
            const newUser = { ...token.user };
            newUser.isOnboardingComplete = true;
            return {
              ...token,
              user: newUser,
            };
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user = {
          username: token.user.username as string,
          name: token.user.name as string,
          id: token.user.id,
          admin: token.user.admin,
          userGroup: token.user.userGroup,
          year: token.user.year,
          isOnboardingComplete: token.user.isOnboardingComplete,
        };
      }
      session.error = token.error;
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  adapter: PrismaAdapter(db),
  providers: [
    CredentialsProvider({
      name: "LDAP",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // @ts-ignore
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password)
          throw new Error("Missing Credentials");

        let authenticatedUserGroup = await verifyPassword(
          credentials.username,
          credentials.password,
        );

        if (!authenticatedUserGroup) throw new Error("Invalid Credentials");

        let user = await db.user.findFirst({
          where: {
            username: credentials.username,
          },
          select: {
            id: true,
            name: true,
            username: true,
            userGroup: true,
            admin: {
              select: {
                permissions: true,
              },
            },
            student: {
              select: {
                admissionYear: true,
                program: true,
                isOnboardingComplete: true,
              },
            },
          },
        });

        if (!user) {
          const userCount = await db.user.count();
          if (authenticatedUserGroup === "student") {
            let userData = await getStudentAviralData(
              credentials.username,
              credentials.password,
            );
            if (!userData) throw new Error("User Not Found");

            user = await db.user.create({
              data: {
                userGroup: authenticatedUserGroup,
                username: credentials.username,
                name: userData.name,
                email: credentials.username + "@iiita.ac.in",
                ...(userCount === 0 && {
                  admin: {
                    create: {
                      permissions: 1,
                    },
                  },
                }),
                student: {
                  create: {
                    program: userData.program,
                    admissionYear: userData.admissionYear,
                    duration: userData.duration,
                    currentSemester: userData.currentSem,
                    completedCredits: userData.completedCredits,
                    totalCredits: userData.totalCredits,
                    cgpa: userData.cgpa,
                    email: credentials.username + "@iiita.ac.in",
                  },
                },
              },
              select: {
                id: true,
                name: true,
                username: true,
                userGroup: true,
                admin: {
                  select: {
                    permissions: true,
                  },
                },
                student: {
                  select: {
                    admissionYear: true,
                    program: true,
                    isOnboardingComplete: true,
                  },
                },
              },
            });
          } else if (authenticatedUserGroup === "faculty") {
            let userData = await getStudentAviralData(
              credentials.username,
              credentials.password,
            );
            if (!userData) throw new Error("User Not Found");
            user = await db.user.create({
              data: {
                userGroup: authenticatedUserGroup,
                username: credentials.username,
                name: userData.name,
                email: credentials.username + "@iiita.ac.in",
                admin: {
                  create: {
                    permissions: userCount === 0 ? 1 : 0,
                  },
                },
              },
              select: {
                id: true,
                name: true,
                username: true,
                userGroup: true,
                admin: {
                  select: {
                    permissions: true,
                  },
                },
                student: {
                  select: {
                    admissionYear: true,
                    program: true,
                    isOnboardingComplete: true,
                  },
                },
              },
            });
          } else {
            throw new Error("Only students and faculties supported");
          }
        }

        const latestYear = await db.participatingGroups.findFirst({
          select: {
            year: true,
          },
          where: {
            ...(user.student && {
              admissionYear: user.student?.admissionYear,
              program: user.student?.program,
            }),
          },
          orderBy: {
            year: "desc",
          },
        });

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          userGroup: user.userGroup,
          admin: user.admin,
          isOnboardingComplete: user.student
            ? user.student.isOnboardingComplete
            : true,
          year: latestYear?.year,
        } as DefaultSession["user"];
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
};

export const getServerAuthSession = () => {
  return getServerSession(authOptions);
};
