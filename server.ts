import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("a2r.db");
db.pragma('foreign_keys = ON');

// Initialize Database with a clean schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    photo TEXT,
    pin TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    initial_stock INTEGER DEFAULT 0,
    available_stock INTEGER DEFAULT 0,
    height REAL,
    width REAL,
    length REAL,
    photo TEXT
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
    quantity INTEGER NOT NULL,
    date TEXT NOT NULL,
    observations TEXT,
    destination TEXT,
    related_movement_id INTEGER,
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reset_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_contact TEXT,
    delivery_date TEXT,
    assembly_date TEXT,
    collection_date TEXT,
    with_assembly INTEGER DEFAULT 0,
    location_id INTEGER NOT NULL,
    space_at_location TEXT,
    observations TEXT,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(location_id) REFERENCES locations(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS output_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    output_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    quantity_out INTEGER NOT NULL,
    quantity_in INTEGER DEFAULT 0,
    FOREIGN KEY(output_id) REFERENCES outputs(id) ON DELETE CASCADE,
    FOREIGN KEY(article_id) REFERENCES articles(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[SERVER] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working" });
  });

  // Auth Endpoints
  app.post("/api/login", (req, res) => {
    const { pin } = req.body;
    const user = db.prepare("SELECT id, name, email, photo FROM users WHERE pin = ?").get(pin);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "PIN inválido" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { name, email, photo, pin } = req.body;
    try {
      const info = db.prepare("INSERT INTO users (name, email, photo, pin) VALUES (?, ?, ?, ?)").run(name, email, photo, pin);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, name, email, photo FROM users").all();
    res.json(users);
  });

  // PIN Recovery Endpoints
  app.post("/api/auth/forgot-pin", (req, res) => {
    const { email } = req.body;
    console.log(`[RECOVERY] Request for email: ${email}`);
    
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    console.log(`[RECOVERY] Total users in DB: ${userCount.count}`);

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    
    if (!user) {
      return res.status(400).json({ error: "Utilizador não encontrado com este email." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

    db.prepare("DELETE FROM reset_codes WHERE email = ?").run(email);
    db.prepare("INSERT INTO reset_codes (email, code, expires_at) VALUES (?, ?, ?)").run(email, code, expiresAt);

    console.log(`[RECOVERY] To: ${email} | Code: ${code}`);
    res.json({ success: true, message: "Código de recuperação enviado para o seu email." });
  });

  app.post("/api/auth/verify-code", (req, res) => {
    const { email, code } = req.body;
    const record = db.prepare("SELECT * FROM reset_codes WHERE email = ? AND code = ?").get(email, code) as any;

    if (!record) return res.status(400).json({ error: "Código inválido." });
    if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: "Código expirado." });

    res.json({ success: true });
  });

  app.post("/api/auth/reset-pin", (req, res) => {
    const { email, code, newPin } = req.body;
    const record = db.prepare("SELECT * FROM reset_codes WHERE email = ? AND code = ?").get(email, code) as any;
    
    if (!record || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ error: "Sessão inválida." });
    }

    db.prepare("UPDATE users SET pin = ? WHERE email = ?").run(newPin, email);
    db.prepare("DELETE FROM reset_codes WHERE email = ?").run(email);
    res.json({ success: true });
  });

  // Articles Endpoints
  app.get("/api/articles", (req, res) => {
    const articles = db.prepare("SELECT * FROM articles ORDER BY description ASC").all();
    res.json(articles);
  });

  app.post("/api/articles", (req, res) => {
    const { code, description, initial_stock, height, width, length, photo } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO articles (code, description, initial_stock, available_stock, height, width, length, photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(code, description, initial_stock, initial_stock, height, width, length, photo);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/articles/:id", (req, res) => {
    const { id } = req.params;
    const { code, description, initial_stock, height, width, length, photo } = req.body;
    
    try {
      const article = db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as any;
      if (!article) return res.status(404).json({ error: "Artigo não encontrado" });

      const diff = initial_stock - article.initial_stock;
      const newAvailable = article.available_stock + diff;

      db.prepare(`
        UPDATE articles 
        SET code = ?, description = ?, initial_stock = ?, available_stock = ?, height = ?, width = ?, length = ?, photo = ?
        WHERE id = ?
      `).run(code, description, initial_stock, newAvailable, height, width, length, photo, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/articles/:id", (req, res) => {
    const { id } = req.params;
    try {
      const result = db.prepare("DELETE FROM articles WHERE id = ?").run(id);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Artigo não encontrado" });
      }
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Locations Endpoints
  app.get("/api/locations", (req, res) => {
    const locations = db.prepare("SELECT * FROM locations ORDER BY name ASC").all();
    res.json(locations);
  });

  // Outputs Endpoints
  app.post("/api/outputs", (req, res) => {
    const { 
      type, client_name, client_contact, delivery_date, 
      assembly_date, collection_date, with_assembly, 
      location_name, space_at_location, observations, 
      user_id, items 
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "A saída deve conter pelo menos um artigo." });
    }

    try {
      const transaction = db.transaction(() => {
        // 1. Handle Location
        let location = db.prepare("SELECT id FROM locations WHERE name = ?").get(location_name) as any;
        if (!location) {
          const info = db.prepare("INSERT INTO locations (name) VALUES (?)").run(location_name);
          location = { id: info.lastInsertRowid };
        }

        // 2. Insert Output
        const createdAt = new Date().toISOString();
        const outputInfo = db.prepare(`
          INSERT INTO outputs (
            type, client_name, client_contact, delivery_date, 
            assembly_date, collection_date, with_assembly, 
            location_id, space_at_location, observations, 
            user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          type, client_name, client_contact, delivery_date, 
          assembly_date, collection_date, with_assembly ? 1 : 0, 
          location.id, space_at_location, observations, 
          user_id, createdAt
        );

        const outputId = outputInfo.lastInsertRowid;

        // 3. Process Items
        for (const item of items) {
          const article = db.prepare("SELECT available_stock, description FROM articles WHERE id = ?").get(item.article_id) as any;
          
          if (!article) {
            throw new Error(`Artigo com ID ${item.article_id} não encontrado.`);
          }

          if (article.available_stock < item.quantity_out) {
            throw new Error(`Stock insuficiente para o artigo: ${article.description}. Disponível: ${article.available_stock}, Solicitado: ${item.quantity_out}`);
          }

          // Update Article Stock
          db.prepare("UPDATE articles SET available_stock = available_stock - ? WHERE id = ?")
            .run(item.quantity_out, item.article_id);

          // Insert Output Item
          db.prepare("INSERT INTO output_items (output_id, article_id, quantity_out) VALUES (?, ?, ?)")
            .run(outputId, item.article_id, item.quantity_out);

          // Insert Movement (for history)
          db.prepare(`
            INSERT INTO movements (article_id, user_id, type, quantity, date, observations, destination)
            VALUES (?, ?, 'OUT', ?, ?, ?, ?)
          `).run(
            item.article_id, user_id, item.quantity_out, createdAt, 
            `Entrega #${outputId}: ${type}`, location_name
          );
        }

        return outputId;
      });

      const outputId = transaction();
      res.json({ id: outputId });
    } catch (e: any) {
      console.error("[OUTPUT ERROR]", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/outputs", (req, res) => {
    const outputs = db.prepare(`
      SELECT o.*, l.name as location_name, u.name as user_name
      FROM outputs o
      JOIN locations l ON o.location_id = l.id
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `).all();

    for (const output of outputs as any[]) {
      output.items = db.prepare(`
        SELECT oi.*, a.description as article_description, a.code as article_code
        FROM output_items oi
        JOIN articles a ON oi.article_id = a.id
        WHERE oi.output_id = ?
      `).all(output.id);
    }

    res.json(outputs);
  });

  app.delete("/api/outputs/:id", (req, res) => {
    const { id } = req.params;
    try {
      const transaction = db.transaction(() => {
        const items = db.prepare("SELECT * FROM output_items WHERE output_id = ?").all(id) as any[];
        
        // Revert stock for each item
        for (const item of items) {
          db.prepare("UPDATE articles SET available_stock = available_stock + ? WHERE id = ?")
            .run(item.quantity_out - item.quantity_in, item.article_id);
        }

        // Delete associated movements
        db.prepare("DELETE FROM movements WHERE observations LIKE ?").run(`Entrega #${id}:%`);
        db.prepare("DELETE FROM movements WHERE observations LIKE ?").run(`Recolha (Retorno Entrega #${id})%`);

        // Delete output and items (cascade handles items if configured, but let's be explicit if not sure)
        db.prepare("DELETE FROM output_items WHERE output_id = ?").run(id);
        db.prepare("DELETE FROM outputs WHERE id = ?").run(id);

        return true;
      });

      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/outputs/:id", (req, res) => {
    const { id } = req.params;
    const { 
      type, client_name, client_contact, delivery_date, 
      assembly_date, collection_date, with_assembly, 
      location_name, space_at_location, observations,
      items, user_id
    } = req.body;

    try {
      const transaction = db.transaction(() => {
        // Handle location
        let locationId;
        const existingLocation = db.prepare("SELECT id FROM locations WHERE name = ?").get(location_name) as any;
        if (existingLocation) {
          locationId = existingLocation.id;
        } else {
          const result = db.prepare("INSERT INTO locations (name) VALUES (?)").run(location_name);
          locationId = result.lastInsertRowid;
        }

        db.prepare(`
          UPDATE outputs SET 
            type = ?, client_name = ?, client_contact = ?, 
            delivery_date = ?, assembly_date = ?, collection_date = ?, 
            with_assembly = ?, location_id = ?, space_at_location = ?, 
            observations = ?
          WHERE id = ?
        `).run(
          type, client_name, client_contact, 
          delivery_date, assembly_date, collection_date, 
          with_assembly ? 1 : 0, locationId, space_at_location, 
          observations, id
        );

        // Handle items update
        if (items) {
          const currentItems = db.prepare("SELECT * FROM output_items WHERE output_id = ?").all(id) as any[];
          const newItemIds = items.map((i: any) => i.article_id);

          // 1. Remove items not in the new list
          for (const currentItem of currentItems) {
            if (!newItemIds.includes(currentItem.article_id)) {
              // Revert stock
              db.prepare("UPDATE articles SET available_stock = available_stock + ? WHERE id = ?")
                .run(currentItem.quantity_out - currentItem.quantity_in, currentItem.article_id);
              // Delete item
              db.prepare("DELETE FROM output_items WHERE id = ?").run(currentItem.id);
              // Delete associated movement
              db.prepare("DELETE FROM movements WHERE observations LIKE ? AND article_id = ?")
                .run(`Entrega #${id}:%`, currentItem.article_id);
            }
          }

          // 2. Update or Add items
          for (const newItem of items) {
            const currentItem = currentItems.find(i => i.article_id === newItem.article_id);
            if (currentItem) {
              // Update existing item
              if (newItem.quantity_out < currentItem.quantity_in) {
                throw new Error(`Quantidade de saída para o artigo ${newItem.article_description} não pode ser inferior à quantidade já devolvida (${currentItem.quantity_in}).`);
              }

              const diff = newItem.quantity_out - currentItem.quantity_out;
              if (diff !== 0) {
                if (diff > 0) {
                  const article = db.prepare("SELECT available_stock FROM articles WHERE id = ?").get(newItem.article_id) as any;
                  if (article.available_stock < diff) {
                    throw new Error(`Stock insuficiente para o artigo ${newItem.article_description}. Disponível: ${article.available_stock}`);
                  }
                }
                db.prepare("UPDATE articles SET available_stock = available_stock - ? WHERE id = ?")
                  .run(diff, newItem.article_id);
                db.prepare("UPDATE output_items SET quantity_out = ? WHERE id = ?")
                  .run(newItem.quantity_out, currentItem.id);
                db.prepare("UPDATE movements SET quantity = ? WHERE observations LIKE ? AND article_id = ?")
                  .run(newItem.quantity_out, `Entrega #${id}:%`, newItem.article_id);
              }
            } else {
              // Add new item
              const article = db.prepare("SELECT available_stock FROM articles WHERE id = ?").get(newItem.article_id) as any;
              if (article.available_stock < newItem.quantity_out) {
                throw new Error(`Stock insuficiente para o artigo ${newItem.article_description}. Disponível: ${article.available_stock}`);
              }
              db.prepare("UPDATE articles SET available_stock = available_stock - ? WHERE id = ?")
                .run(newItem.quantity_out, newItem.article_id);
              db.prepare("INSERT INTO output_items (output_id, article_id, quantity_out, quantity_in) VALUES (?, ?, ?, 0)")
                .run(id, newItem.article_id, newItem.quantity_out);
              
              const createdAt = new Date().toISOString();
              db.prepare(`
                INSERT INTO movements (article_id, user_id, type, quantity, date, observations)
                VALUES (?, ?, 'OUT', ?, ?, ?)
              `).run(newItem.article_id, user_id, newItem.quantity_out, createdAt, `Entrega #${id}: ${client_name}`);
            }
          }
        }

        return true;
      });

      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/outputs/:id/return", (req, res) => {
    const { id } = req.params;
    const { items, user_id } = req.body; // items is [{ article_id, quantity_in, observations }]

    try {
      const transaction = db.transaction(() => {
        const output = db.prepare("SELECT * FROM outputs WHERE id = ?").get(id) as any;
        if (!output) throw new Error("Entrega não encontrada.");

        const createdAt = new Date().toISOString();

        for (const item of items) {
          // Update output_items
          db.prepare("UPDATE output_items SET quantity_in = quantity_in + ? WHERE output_id = ? AND article_id = ?")
            .run(item.quantity_in, id, item.article_id);

          // Update article stock
          db.prepare("UPDATE articles SET available_stock = available_stock + ? WHERE id = ?")
            .run(item.quantity_in, item.article_id);

          // Insert Movement
          db.prepare(`
            INSERT INTO movements (article_id, user_id, type, quantity, date, observations, destination)
            VALUES (?, ?, 'IN', ?, ?, ?, ?)
          `).run(
            item.article_id, user_id, item.quantity_in, createdAt, 
            `Recolha (Retorno Entrega #${id}): ${item.observations || ''}`, 'Armazém'
          );
        }

        return true;
      });

      transaction();
      res.json({ success: true });
    } catch (e: any) {
      console.error("[RETURN ERROR]", e);
      res.status(400).json({ error: e.message });
    }
  });

  // Movements Endpoints
  app.get("/api/movements", (req, res) => {
    const movements = db.prepare(`
      SELECT m.*, a.description as article_description, a.code as article_code, u.name as user_name
      FROM movements m
      JOIN articles a ON m.article_id = a.id
      JOIN users u ON m.user_id = u.id
      ORDER BY m.date DESC
    `).all();
    res.json(movements);
  });

  app.delete("/api/movements/:id", (req, res) => {
    const { id } = req.params;
    try {
      const transaction = db.transaction(() => {
        const movement = db.prepare("SELECT * FROM movements WHERE id = ?").get(id) as any;
        if (!movement) throw new Error("Movimento não encontrado.");

        // If it's a return movement, we need to update the output_items
        const returnMatch = movement.observations?.match(/Recolha \(Retorno Entrega #(\d+)\)/);
        if (returnMatch && movement.type === 'IN') {
          const outputId = returnMatch[1];
          db.prepare("UPDATE output_items SET quantity_in = quantity_in - ? WHERE output_id = ? AND article_id = ?")
            .run(movement.quantity, outputId, movement.article_id);
        }

        // Revert stock
        const stockChange = movement.type === 'IN' ? -movement.quantity : movement.quantity;
        db.prepare("UPDATE articles SET available_stock = available_stock + ? WHERE id = ?")
          .run(stockChange, movement.article_id);

        db.prepare("DELETE FROM movements WHERE id = ?").run(id);
        return true;
      });

      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/movements/:id", (req, res) => {
    const { id } = req.params;
    const { quantity, observations } = req.body;

    try {
      const transaction = db.transaction(() => {
        const movement = db.prepare("SELECT * FROM movements WHERE id = ?").get(id) as any;
        if (!movement) throw new Error("Movimento não encontrado.");

        // If it's a return movement, we need to update the output_items
        const returnMatch = movement.observations?.match(/Recolha \(Retorno Entrega #(\d+)\)/);
        if (returnMatch && movement.type === 'IN') {
          const outputId = returnMatch[1];
          
          // Revert old quantity
          db.prepare("UPDATE output_items SET quantity_in = quantity_in - ? WHERE output_id = ? AND article_id = ?")
            .run(movement.quantity, outputId, movement.article_id);
          db.prepare("UPDATE articles SET available_stock = available_stock - ? WHERE id = ?")
            .run(movement.quantity, movement.article_id);

          // Apply new quantity
          db.prepare("UPDATE output_items SET quantity_in = quantity_in + ? WHERE output_id = ? AND article_id = ?")
            .run(quantity, outputId, movement.article_id);
          db.prepare("UPDATE articles SET available_stock = available_stock + ? WHERE id = ?")
            .run(quantity, movement.article_id);
        } else {
          // General movement stock update
          const oldStockChange = movement.type === 'IN' ? movement.quantity : -movement.quantity;
          const newStockChange = movement.type === 'IN' ? quantity : -quantity;
          db.prepare("UPDATE articles SET available_stock = available_stock - ? + ? WHERE id = ?")
            .run(oldStockChange, newStockChange, movement.article_id);
        }

        db.prepare("UPDATE movements SET quantity = ?, observations = ? WHERE id = ?")
          .run(quantity, observations, id);

        return true;
      });

      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/movements", (req, res) => {
    const { article_id, user_id, type, quantity, date, observations, destination, related_movement_id } = req.body;
    
    try {
      const transaction = db.transaction(() => {
        const article = db.prepare("SELECT available_stock FROM articles WHERE id = ?").get(article_id) as any;
        if (!article) throw new Error("Artigo não encontrado");

        const qty = Number(quantity);
        let newStock = article.available_stock;
        if (type === 'OUT') {
          if (article.available_stock < qty) throw new Error("Stock insuficiente");
          newStock -= qty;
        } else {
          newStock += qty;
        }

        db.prepare("UPDATE articles SET available_stock = ? WHERE id = ?").run(newStock, article_id);
        
        const info = db.prepare(`
          INSERT INTO movements (article_id, user_id, type, quantity, date, observations, destination, related_movement_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(article_id, user_id, type, qty, date, observations, destination, related_movement_id);

        return info.lastInsertRowid;
      });

      const id = transaction();
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
