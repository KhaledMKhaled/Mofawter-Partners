import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { User } from "@workspace/db";

const JWT_SECRET =
  process.env.JWT_SECRET ??
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error(
          "JWT_SECRET environment variable is required in production",
        );
      })()
    : "dev-only-change-me-in-prod");

export type AuthRole = "ADMIN" | "OPERATIONS" | "DISTRIBUTOR" | "SALES";


export type JwtPayload = {
  sub: number;
  role: AuthRole;
  distributorId: number | null;
};

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: User): string {
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role as AuthRole,
    distributorId: user.distributorId ?? null,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function toUserDto(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    distributorId: user.distributorId ?? null,
    phone: user.phone ?? null,
    internalCode: user.internalCode ?? null,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
