import { relations, sql } from "drizzle-orm";
import ShortUniqueId from "short-unique-id";
import {
  boolean,
  index,
  int,
  mysqlTableCreator,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { type AdapterAccount } from "next-auth/adapters";

const uid = new ShortUniqueId({ length: 10 });

const mysqlTable = mysqlTableCreator((name) => `utkarsh-portal_${name}`);

export const userModel = mysqlTable("user", {
  // required for next-auth
  id: varchar("id", { length: 255 }).notNull().$defaultFn(() => {
    return uid.randomUUID();
  }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
    fsp: 3,
  }).default(sql`CURRENT_TIMESTAMP(3)`),
  image: varchar("image", { length: 255 }),

  // custom fields
  // username: varchar("username", { length: 32 }).notNull().unique(),
  rollNumber: varchar("rollNumber", { length: 10 }).notNull().unique(),
  mobile : varchar("mobile", { length: 10 }).notNull().unique(),
  cgpa : int("cgpa").notNull(),
  resumeLink : varchar("resumeLink", { length: 255 }),
  currentSem : varchar("currentSem", { length: 255 }).notNull(),
  completedCredits : int("completedCredits").notNull(),
  totalCredits : int("totalCredits").notNull(),
  admissionYear : int("admissionYear").notNull(),
  program : varchar("program", { length: 255 }).notNull(),
  isAdmin : boolean("isAdmin").default(false),
  // userGroup: varchar("userGroup", { length: 32 }).notNull(),
}, (user) => ({
  rollNumberIdx : index("rollNumber_idx").on(user.rollNumber),
}));

export const usersRelations = relations(userModel, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

// required for next-auth
export const accounts = mysqlTable(
  "account",
  {
    userId: varchar("userId", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId),
    userIdIdx: index("userId_idx").on(account.userId),
  })
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(userModel, { fields: [accounts.userId], references: [userModel.id] }),
}));

// required for next-auth
export const sessions = mysqlTable(
  "session",
  {
    sessionToken: varchar("sessionToken", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("userId", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("userId_idx").on(session.userId),
  })
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(userModel, { fields: [sessions.userId], references: [userModel.id] }),
}));

// required for next-auth
export const verificationTokens = mysqlTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey(vt.identifier, vt.token),
  })
);
