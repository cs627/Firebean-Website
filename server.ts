import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Firebean Server Running" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);

    // Development routing for multiple HTML files
    app.get("/work.html", async (req, res) => {
      try {
        const html = await vite.transformIndexHtml(req.url, await fs.readFile(path.resolve(__dirname, "work.html"), "utf-8"));
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        res.status(500).end((e as Error).message);
      }
    });

    app.get("/profile.html", async (req, res) => {
      try {
        const html = await vite.transformIndexHtml(req.url, await fs.readFile(path.resolve(__dirname, "profile.html"), "utf-8"));
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        res.status(500).end((e as Error).message);
      }
    });

    // Default to index.html
    app.get("*", async (req, res) => {
      try {
        const url = req.originalUrl;
        const html = await vite.transformIndexHtml(url, await fs.readFile(path.resolve(__dirname, "index.html"), "utf-8"));
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        res.status(500).end((e as Error).message);
      }
    });
  } else {
    // Production: Serve from dist
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));

    app.get("/work", (req, res) => {
      res.sendFile(path.resolve(distPath, "work.html"));
    });

    app.get("/profile", (req, res) => {
      res.sendFile(path.resolve(distPath, "profile.html"));
    });

    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Firebean Portfolio running at http://localhost:${PORT}`);
  });
}

startServer();
