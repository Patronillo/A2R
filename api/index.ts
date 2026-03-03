import express from "express";

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "A2R Inventory API is running on Vercel" });
});

// Adicione aqui as rotas da API que estavam no server.ts original

export default app;
