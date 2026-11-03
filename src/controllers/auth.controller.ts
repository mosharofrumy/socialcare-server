import type { RequestHandler } from "express";
import { MongoServerError } from "mongodb";
import { cookieOptions, generateToken } from "../utils/jwt.js";
import {
  emailOf,
  findUserByEmail,
  findUserById,
  registerUser,
  safeUser,
  verifyPassword,
} from "../services/auth.service.js";

export const register: RequestHandler = async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};
    const normalizedEmail = emailOf(email);

    if (typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({
        message: "Name must be at least 2 characters long.",
      });
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const savedUser = await registerUser(name, normalizedEmail, password);
    const token = generateToken(savedUser);
    res.cookie("token", token, cookieOptions);
    return res.status(201).json({
      message: "Registration successful.",
      user: safeUser(savedUser),
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }
    console.error("Registration error:", error);
    return res.status(500).json({
      message: "Something went wrong during registration.",
    });
  }
};

export const login: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const normalizedEmail = emailOf(email);

    if (!normalizedEmail || typeof password !== "string") {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = generateToken(user);
    res.cookie("token", token, cookieOptions);
    return res.json({
      message: "Login successful.",
      user: safeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Something went wrong during login.",
    });
  }
};

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: "/",
  });
  return res.json({ message: "Logout successful." });
};

export const getCurrentUser: RequestHandler = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Please login first." });
    }
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.json({ user: safeUser(user) });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      message: "Could not fetch user information.",
    });
  }
};
