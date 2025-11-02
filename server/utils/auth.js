import jwt from "jsonwebtoken";

export const verifyToken = (req) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader) throw new Error("Missing Authorization header");
  const parts = authHeader.split(" ");
  if (parts.length < 2) throw new Error("Invalid Authorization header");
  const token = parts[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid token");
  }
};
