import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "./config/passport.js";
import { env } from "./config/env.js";
import { errorMiddleware, notFound } from "./middlewares/error.middleware.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
// Other route imports get added here as each phase is built:
// import projectRoutes from "./routes/project.routes.js";
// etc.

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session is ONLY used to hold state during the Google OAuth redirect.
// No route in this app uses session-based auth otherwise — everything
// downstream of login runs on JWT.
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 5 * 60 * 1000 }, // 5 min, just enough for the OAuth round trip
  })
);
app.use(passport.initialize());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
// app.use("/api/projects", projectRoutes);

app.use(notFound);
app.use(errorMiddleware);

export default app;
