import express from "express";
import { sql } from "@vercel/postgres";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Check for required environment variables
if (!process.env.POSTGRES_URL) {
  console.warn("[DB] Warning: POSTGRES_URL is not set. Database operations will fail.");
}

// Helper to ensure schema exists and is up to date
async function ensureSchema() {
  console.log("[DB] Ensuring schema...");
  try {
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        photo TEXT,
        pin TEXT NOT NULL
      )
    `;

    // Articles table
    await sql`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        total_stock INTEGER DEFAULT 0,
        available_stock INTEGER DEFAULT 0,
        height FLOAT,
        width FLOAT,
        length FLOAT,
        weight FLOAT,
        photo TEXT
      )
    `;

    // Add weight column if it doesn't exist
    try {
      await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS weight FLOAT`;
    } catch (e) {
      // Column might already exist
    }

    // Rename initial_stock to total_stock if it exists
    try {
      await sql`ALTER TABLE articles RENAME COLUMN initial_stock TO total_stock`;
    } catch (e) {
      // Column might already be renamed or table is new
    }

    // Stock Movements table
    await sql`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
        quantity INTEGER NOT NULL,
        date TIMESTAMP NOT NULL,
        document_number TEXT,
        observations TEXT
      )
    `;

    // Reset codes table
    await sql`
      CREATE TABLE IF NOT EXISTS reset_codes (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `;

    // Locations table
    await sql`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `;

    // Employees table
    await sql`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `;

    // Outputs table
    await sql`
      CREATE TABLE IF NOT EXISTS outputs (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_contact TEXT,
        delivery_date TIMESTAMP,
        assembly_date TIMESTAMP,
        collection_date TIMESTAMP,
        with_assembly BOOLEAN DEFAULT FALSE,
        location_id INTEGER NOT NULL REFERENCES locations(id),
        space_at_location TEXT,
        observations TEXT,
        delivery_employee TEXT,
        collection_employee TEXT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Output items table
    await sql`
      CREATE TABLE IF NOT EXISTS output_items (
        id SERIAL PRIMARY KEY,
        output_id INTEGER NOT NULL REFERENCES outputs(id) ON DELETE CASCADE,
        article_id INTEGER NOT NULL REFERENCES articles(id),
        quantity_out INTEGER NOT NULL,
        quantity_in INTEGER DEFAULT 0
      )
    `;

    console.log("[DB] Schema ensured.");
  } catch (error) {
    console.error("[DB] Error ensuring schema:", error);
  }
}

// Helper to cleanup unused employees
async function cleanupEmployees() {
  try {
    await sql`
      DELETE FROM employees 
      WHERE name NOT IN (
        SELECT delivery_employee FROM outputs WHERE delivery_employee IS NOT NULL
        UNION
        SELECT collection_employee FROM outputs WHERE collection_employee IS NOT NULL
      )
    `;
    console.log("[DB] Employees cleanup completed.");
  } catch (error) {
    console.error("[DB] Error cleaning up employees:", error);
  }
}

// Initialize schema
ensureSchema().catch(err => console.error("[DB] Initial schema check failed:", err));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "A2R Inventory API is running on Vercel" });
});

app.get("/api/stats/db-size", async (req, res) => {
  try {
    const { rows } = await sql`
      SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))) as size
      FROM pg_tables
      WHERE schemaname = 'public'
    `;
    res.json({ size: rows[0]?.size || '0 B' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

// Auth Endpoints
app.post("/api/login", async (req, res) => {
  const { pin } = req.body;
  try {
    const { rows } = await sql`SELECT id, name, email, photo FROM users WHERE pin = ${pin}`;
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(401).json({ error: "PIN inválido" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/users", async (req, res) => {
  const { name, email, photo, pin } = req.body;
  try {
    const { rows } = await sql`
      INSERT INTO users (name, email, photo, pin) 
      VALUES (${name}, ${email}, ${photo}, ${pin}) 
      RETURNING id
    `;
    res.json({ id: rows[0].id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await sql`SELECT id, name, email, photo FROM users`;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PIN Recovery Endpoints
app.post("/api/auth/forgot-pin", async (req, res) => {
  const { email } = req.body;
  console.log(`[RECOVERY] Request for email: ${email}`);
  
  try {
    const { rows: countRows } = await sql`SELECT COUNT(*) as count FROM users`;
    console.log(`[RECOVERY] Total users in DB: ${countRows[0].count}`);

    const { rows: userRows } = await sql`SELECT * FROM users WHERE email = ${email}`;
    
    if (userRows.length === 0) {
      return res.status(400).json({ error: "Utilizador não encontrado com este email." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();

    await sql`DELETE FROM reset_codes WHERE email = ${email}`;
    await sql`INSERT INTO reset_codes (email, code, expires_at) VALUES (${email}, ${code}, ${expiresAt})`;

    console.log(`[RECOVERY] To: ${email} | Code: ${code}`);
    res.json({ success: true, message: "Código de recuperação enviado para o seu email." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/verify-code", async (req, res) => {
  const { email, code } = req.body;
  try {
    const { rows } = await sql`SELECT * FROM reset_codes WHERE email = ${email} AND code = ${code}`;

    if (rows.length === 0) return res.status(400).json({ error: "Código inválido." });
    if (new Date(rows[0].expires_at) < new Date()) return res.status(400).json({ error: "Código expirado." });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/reset-pin", async (req, res) => {
  const { email, code, newPin } = req.body;
  try {
    const { rows } = await sql`SELECT * FROM reset_codes WHERE email = ${email} AND code = ${code}`;
    
    if (rows.length === 0 || new Date(rows[0].expires_at) < new Date()) {
      return res.status(400).json({ error: "Sessão inválida." });
    }

    await sql`UPDATE users SET pin = ${newPin} WHERE email = ${email}`;
    await sql`DELETE FROM reset_codes WHERE email = ${email}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Articles Endpoints
app.get("/api/articles", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM articles ORDER BY description ASC`;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/articles", async (req, res) => {
  const { code, description, total_stock, height, width, length, weight, photo } = req.body;
  try {
    const h = isNaN(parseFloat(height)) ? null : parseFloat(height);
    const w = isNaN(parseFloat(width)) ? null : parseFloat(width);
    const l = isNaN(parseFloat(length)) ? null : parseFloat(length);
    const wg = isNaN(parseFloat(weight)) ? null : parseFloat(weight);
    const ts = isNaN(parseInt(total_stock)) ? 0 : parseInt(total_stock);

    const { rows } = await sql`
      INSERT INTO articles (code, description, total_stock, available_stock, height, width, length, weight, photo)
      VALUES (${code}, ${description}, ${ts}, ${ts}, ${h}, ${w}, ${l}, ${wg}, ${photo})
      RETURNING id
    `;
    res.json({ id: rows[0].id });
  } catch (e: any) {
    console.error("[DB] Error creating article:", e);
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/articles/:id", async (req, res) => {
  const { id } = req.params;
  const { code, description, total_stock, height, width, length, weight, photo } = req.body;
  
  try {
    const { rows } = await sql`SELECT * FROM articles WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Artigo não encontrado" });

    const article = rows[0];
    const ts = isNaN(parseInt(total_stock)) ? article.total_stock : parseInt(total_stock);
    const diff = ts - article.total_stock;
    const newAvailable = article.available_stock + diff;

    const h = isNaN(parseFloat(height)) ? null : parseFloat(height);
    const w = isNaN(parseFloat(width)) ? null : parseFloat(width);
    const l = isNaN(parseFloat(length)) ? null : parseFloat(length);
    const wg = isNaN(parseFloat(weight)) ? null : parseFloat(weight);

    await sql`
      UPDATE articles 
      SET code = ${code}, description = ${description}, total_stock = ${ts}, available_stock = ${newAvailable}, height = ${h}, width = ${w}, length = ${l}, weight = ${wg}, photo = ${photo}
      WHERE id = ${id}
    `;
    res.json({ success: true });
  } catch (e: any) {
    console.error("[DB] Error updating article:", e);
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/articles/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await sql`DELETE FROM articles WHERE id = ${id}`;
    if (rowCount !== null && rowCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Artigo não encontrado" });
    }
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Locations Endpoints
app.get("/api/locations", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM locations ORDER BY name ASC`;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Employees Endpoints
app.get("/api/employees", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM employees ORDER BY name ASC`;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Outputs Endpoints
app.post("/api/outputs", async (req, res) => {
  const { 
    type, client_name, client_contact, delivery_date, 
    assembly_date, collection_date, with_assembly, 
    location_name, space_at_location, observations, 
    delivery_employee, collection_employee,
    user_id, items 
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "A saída deve conter pelo menos um artigo." });
  }

  try {
    // 1. Handle Location
    let locationId;
    const { rows: locRows } = await sql`SELECT id FROM locations WHERE name = ${location_name}`;
    if (locRows.length === 0) {
      const { rows: newLocRows } = await sql`INSERT INTO locations (name) VALUES (${location_name}) RETURNING id`;
      locationId = newLocRows[0].id;
    } else {
      locationId = locRows[0].id;
    }

    // 2. Handle Employees
    if (delivery_employee) {
      const { rows: empRows } = await sql`SELECT id FROM employees WHERE name = ${delivery_employee}`;
      if (empRows.length === 0) {
        await sql`INSERT INTO employees (name) VALUES (${delivery_employee})`;
      }
    }
    if (collection_employee) {
      const { rows: empRows } = await sql`SELECT id FROM employees WHERE name = ${collection_employee}`;
      if (empRows.length === 0) {
        await sql`INSERT INTO employees (name) VALUES (${collection_employee})`;
      }
    }

    // 3. Insert Output
    const createdAt = new Date().toISOString();
    const { rows: outputRows } = await sql`
      INSERT INTO outputs (
        type, client_name, client_contact, delivery_date, 
        assembly_date, collection_date, with_assembly, 
        location_id, space_at_location, observations, 
        delivery_employee, collection_employee,
        user_id, created_at
      ) VALUES (
        ${type}, ${client_name}, ${client_contact}, ${delivery_date}, 
        ${assembly_date}, ${collection_date}, ${with_assembly}, 
        ${locationId}, ${space_at_location}, ${observations}, 
        ${delivery_employee || null}, ${collection_employee || null},
        ${user_id}, ${createdAt}
      ) RETURNING id
    `;

    const outputId = outputRows[0].id;

    // 4. Process Items
    for (const item of items) {
      // Update Article Stock
      await sql`UPDATE articles SET available_stock = available_stock - ${item.quantity_out} WHERE id = ${item.article_id}`;

      // Insert Output Item
      await sql`INSERT INTO output_items (output_id, article_id, quantity_out) VALUES (${outputId}, ${item.article_id}, ${item.quantity_out})`;

      // Insert Movement (for history)
      await sql`
        INSERT INTO movements (article_id, user_id, type, quantity, date, observations, destination)
        VALUES (${item.article_id}, ${user_id}, 'OUT', ${item.quantity_out}, ${createdAt}, ${`Entrega #${outputId}: ${type}`}, ${location_name})
      `;
    }

    await cleanupEmployees();
    res.json({ id: outputId });
  } catch (e: any) {
    console.error("[OUTPUT ERROR]", e);
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/outputs", async (req, res) => {
  try {
    const { rows: outputs } = await sql`
      SELECT o.*, l.name as location_name, u.name as user_name
      FROM outputs o
      JOIN locations l ON o.location_id = l.id
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `;

    for (const output of outputs as any[]) {
      const { rows: items } = await sql`
        SELECT oi.*, a.description as article_description, a.code as article_code
        FROM output_items oi
        JOIN articles a ON oi.article_id = a.id
        WHERE oi.output_id = ${output.id}
      `;
      output.items = items;
    }

    res.json(outputs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/outputs/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: items } = await sql`SELECT * FROM output_items WHERE output_id = ${id}`;
    
    // Revert stock for each item
    for (const item of items) {
      await sql`UPDATE articles SET available_stock = available_stock + ${item.quantity_out - item.quantity_in} WHERE id = ${item.article_id}`;
    }

    // Delete associated movements
    await sql`DELETE FROM movements WHERE observations LIKE ${`Entrega #${id}:%`}`;
    await sql`DELETE FROM movements WHERE observations LIKE ${`Recolha (Retorno Entrega #${id})%`}`;

    // Delete output and items
    await sql`DELETE FROM output_items WHERE output_id = ${id}`;
    await sql`DELETE FROM outputs WHERE id = ${id}`;

    await cleanupEmployees();
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/outputs/:id", async (req, res) => {
  const { id } = req.params;
  const { 
    type, client_name, client_contact, delivery_date, 
    assembly_date, collection_date, with_assembly, 
    location_name, space_at_location, observations,
    delivery_employee, collection_employee,
    items, user_id
  } = req.body;

  try {
    // Handle location
    let locationId;
    const { rows: locRows } = await sql`SELECT id FROM locations WHERE name = ${location_name}`;
    if (locRows.length > 0) {
      locationId = locRows[0].id;
    } else {
      const { rows: newLocRows } = await sql`INSERT INTO locations (name) VALUES (${location_name}) RETURNING id`;
      locationId = newLocRows[0].id;
    }

    // Handle employees
    if (delivery_employee) {
      const { rows: empRows } = await sql`SELECT id FROM employees WHERE name = ${delivery_employee}`;
      if (empRows.length === 0) {
        await sql`INSERT INTO employees (name) VALUES (${delivery_employee})`;
      }
    }
    if (collection_employee) {
      const { rows: empRows } = await sql`SELECT id FROM employees WHERE name = ${collection_employee}`;
      if (empRows.length === 0) {
        await sql`INSERT INTO employees (name) VALUES (${collection_employee})`;
      }
    }

    await sql`
      UPDATE outputs SET 
        type = ${type}, client_name = ${client_name}, client_contact = ${client_contact}, 
        delivery_date = ${delivery_date}, assembly_date = ${assembly_date}, collection_date = ${collection_date}, 
        with_assembly = ${with_assembly}, location_id = ${locationId}, space_at_location = ${space_at_location}, 
        observations = ${observations}, delivery_employee = ${delivery_employee || null}, collection_employee = ${collection_employee || null}
      WHERE id = ${id}
    `;

    // Handle items update
    if (items) {
      const { rows: currentItems } = await sql`SELECT * FROM output_items WHERE output_id = ${id}`;
      const newItemIds = items.map((i: any) => i.article_id);

      // 1. Remove items not in the new list
      for (const currentItem of currentItems) {
        if (!newItemIds.includes(currentItem.article_id)) {
          // Revert stock
          await sql`UPDATE articles SET available_stock = available_stock + ${currentItem.quantity_out - currentItem.quantity_in} WHERE id = ${currentItem.article_id}`;
          // Delete item
          await sql`DELETE FROM output_items WHERE id = ${currentItem.id}`;
          // Delete associated movement
          await sql`DELETE FROM movements WHERE observations LIKE ${`Entrega #${id}:%`} AND article_id = ${currentItem.article_id}`;
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
            await sql`UPDATE articles SET available_stock = available_stock - ${diff} WHERE id = ${newItem.article_id}`;
            await sql`UPDATE output_items SET quantity_out = ${newItem.quantity_out} WHERE id = ${currentItem.id}`;
            await sql`UPDATE movements SET quantity = ${newItem.quantity_out} WHERE observations LIKE ${`Entrega #${id}:%`} AND article_id = ${newItem.article_id}`;
          }
        } else {
          // Add new item
          await sql`UPDATE articles SET available_stock = available_stock - ${newItem.quantity_out} WHERE id = ${newItem.article_id}`;
          await sql`INSERT INTO output_items (output_id, article_id, quantity_out, quantity_in) VALUES (${id}, ${newItem.article_id}, ${newItem.quantity_out}, 0)`;
          
          const createdAt = new Date().toISOString();
          await sql`
            INSERT INTO movements (article_id, user_id, type, quantity, date, observations)
            VALUES (${newItem.article_id}, ${user_id}, 'OUT', ${newItem.quantity_out}, ${createdAt}, ${`Entrega #${id}: ${client_name}`})
          `;
        }
      }
    }

    await cleanupEmployees();
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.patch("/api/outputs/:id/status", async (req, res) => {
  const { id } = req.params;
  const { delivery_employee, collection_employee } = req.body;
  try {
    if (delivery_employee !== undefined) {
      await sql`UPDATE outputs SET delivery_employee = ${delivery_employee} WHERE id = ${id}`;
      if (delivery_employee) {
        const { rows: empRows } = await sql`SELECT id FROM employees WHERE name = ${delivery_employee}`;
        if (empRows.length === 0) {
          await sql`INSERT INTO employees (name) VALUES (${delivery_employee})`;
        }
      }
    }
    if (collection_employee !== undefined) {
      await sql`UPDATE outputs SET collection_employee = ${collection_employee} WHERE id = ${id}`;
      if (collection_employee) {
        const { rows: empRows } = await sql`SELECT id FROM employees WHERE name = ${collection_employee}`;
        if (empRows.length === 0) {
          await sql`INSERT INTO employees (name) VALUES (${collection_employee})`;
        }
      }
    }
    await cleanupEmployees();
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/outputs/:id/return", async (req, res) => {
  const { id } = req.params;
  const { items, user_id, collection_employee } = req.body; // items is [{ article_id, quantity_in, observations }]

  try {
    const { rows: outputRows } = await sql`SELECT * FROM outputs WHERE id = ${id}`;
    if (outputRows.length === 0) throw new Error("Entrega não encontrada.");

    // Update collection employee if provided
    if (collection_employee) {
      await sql`UPDATE outputs SET collection_employee = ${collection_employee} WHERE id = ${id}`;
      const { rows: empRows } = await sql`SELECT id FROM employees WHERE name = ${collection_employee}`;
      if (empRows.length === 0) {
        await sql`INSERT INTO employees (name) VALUES (${collection_employee})`;
      }
    }

    const createdAt = new Date().toISOString();

    for (const item of items) {
      // Update output_items
      await sql`UPDATE output_items SET quantity_in = quantity_in + ${item.quantity_in} WHERE output_id = ${id} AND article_id = ${item.article_id}`;

      // Update article stock
      await sql`UPDATE articles SET available_stock = available_stock + ${item.quantity_in} WHERE id = ${item.article_id}`;

      // Insert Movement
      await sql`
        INSERT INTO movements (article_id, user_id, type, quantity, date, observations, destination)
        VALUES (${item.article_id}, ${user_id}, 'IN', ${item.quantity_in}, ${createdAt}, ${`Recolha (Retorno Entrega #${id}): ${item.observations || ''}`}, 'Armazém')
      `;
    }

    await cleanupEmployees();
    res.json({ success: true });
  } catch (e: any) {
    console.error("[RETURN ERROR]", e);
    res.status(400).json({ error: e.message });
  }
});

// Movements Endpoints
app.get("/api/movements", async (req, res) => {
  try {
    const { rows: movements } = await sql`
      SELECT m.*, a.description as article_description, a.code as article_code, u.name as user_name
      FROM movements m
      JOIN articles a ON m.article_id = a.id
      JOIN users u ON m.user_id = u.id
      ORDER BY m.date DESC
    `;
    res.json(movements);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/movements/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: movementRows } = await sql`SELECT * FROM movements WHERE id = ${id}`;
    if (movementRows.length === 0) throw new Error("Movimento não encontrado.");

    const movement = movementRows[0];

    // If it's a return movement, we need to update the output_items
    const returnMatch = movement.observations?.match(/Recolha \(Retorno Entrega #(\d+)\)/);
    if (returnMatch && movement.type === 'IN') {
      const outputId = returnMatch[1];
      await sql`UPDATE output_items SET quantity_in = quantity_in - ${movement.quantity} WHERE output_id = ${outputId} AND article_id = ${movement.article_id}`;
    }

    // Revert stock
    const stockChange = movement.type === 'IN' ? -movement.quantity : movement.quantity;
    await sql`UPDATE articles SET available_stock = available_stock + ${stockChange} WHERE id = ${movement.article_id}`;

    await sql`DELETE FROM movements WHERE id = ${id}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/movements/:id", async (req, res) => {
  const { id } = req.params;
  const { quantity, observations } = req.body;

  try {
    const { rows: movementRows } = await sql`SELECT * FROM movements WHERE id = ${id}`;
    if (movementRows.length === 0) throw new Error("Movimento não encontrado.");

    const movement = movementRows[0];

    // If it's a return movement, we need to update the output_items
    const returnMatch = movement.observations?.match(/Recolha \(Retorno Entrega #(\d+)\)/);
    if (returnMatch && movement.type === 'IN') {
      const outputId = returnMatch[1];
      
      // Revert old quantity
      await sql`UPDATE output_items SET quantity_in = quantity_in - ${movement.quantity} WHERE output_id = ${outputId} AND article_id = ${movement.article_id}`;
      await sql`UPDATE articles SET available_stock = available_stock - ${movement.quantity} WHERE id = ${movement.article_id}`;

      // Apply new quantity
      await sql`UPDATE output_items SET quantity_in = quantity_in + ${quantity} WHERE output_id = ${outputId} AND article_id = ${movement.article_id}`;
      await sql`UPDATE articles SET available_stock = available_stock + ${quantity} WHERE id = ${movement.article_id}`;
    } else {
      // General movement stock update
      const oldStockChange = movement.type === 'IN' ? movement.quantity : -movement.quantity;
      const newStockChange = movement.type === 'IN' ? quantity : -quantity;
      await sql`UPDATE articles SET available_stock = available_stock - ${oldStockChange} + ${newStockChange} WHERE id = ${movement.article_id}`;
    }

    await sql`UPDATE movements SET quantity = ${quantity}, observations = ${observations} WHERE id = ${id}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/movements", async (req, res) => {
  const { article_id, user_id, type, quantity, date, observations, destination, related_movement_id } = req.body;
  
  try {
    const { rows: articleRows } = await sql`SELECT available_stock FROM articles WHERE id = ${article_id}`;
    if (articleRows.length === 0) throw new Error("Artigo não encontrado");

    const article = articleRows[0];
    const qty = Number(quantity);
    let newStock = article.available_stock;
    if (type === 'OUT') {
      if (article.available_stock < qty) throw new Error("Stock insuficiente");
      newStock -= qty;
    } else {
      newStock += qty;
    }

    await sql`UPDATE articles SET available_stock = ${newStock} WHERE id = ${article_id}`;
    
    const { rows: movementRows } = await sql`
      INSERT INTO movements (article_id, user_id, type, quantity, date, observations, destination, related_movement_id)
      VALUES (${article_id}, ${user_id}, ${type}, ${qty}, ${date}, ${observations}, ${destination}, ${related_movement_id})
      RETURNING id
    `;

    res.json({ success: true, id: movementRows[0].id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Stock Movements Endpoints
app.get("/api/stock-movements", async (req, res) => {
  try {
    const { rows } = await sql`
      SELECT sm.*, a.description as article_description, a.code as article_code, u.name as user_name
      FROM stock_movements sm
      JOIN articles a ON sm.article_id = a.id
      JOIN users u ON sm.user_id = u.id
      ORDER BY sm.date DESC
    `;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/stock-movements", async (req, res) => {
  const { article_id, user_id, type, quantity, date, document_number, observations } = req.body;
  try {
    const qty = Number(quantity);
    const stockChange = type === 'IN' ? qty : -qty;

    await sql`
      UPDATE articles 
      SET total_stock = total_stock + ${stockChange}, 
          available_stock = available_stock + ${stockChange} 
      WHERE id = ${article_id}
    `;

    const { rows } = await sql`
      INSERT INTO stock_movements (article_id, user_id, type, quantity, date, document_number, observations)
      VALUES (${article_id}, ${user_id}, ${type}, ${qty}, ${date}, ${document_number}, ${observations})
      RETURNING id
    `;
    res.json({ id: rows[0].id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/stock-movements/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: smRows } = await sql`SELECT * FROM stock_movements WHERE id = ${id}`;
    if (smRows.length === 0) return res.status(404).json({ error: "Movimento não encontrado" });

    const sm = smRows[0];
    const stockChange = sm.type === 'IN' ? -sm.quantity : sm.quantity;

    await sql`
      UPDATE articles 
      SET total_stock = total_stock + ${stockChange}, 
          available_stock = available_stock + ${stockChange} 
      WHERE id = ${sm.article_id}
    `;

    await sql`DELETE FROM stock_movements WHERE id = ${id}`;
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// API 404 Handler
app.use("/api", (req, res) => {
  res.status(404).json({ 
    error: "Rota API não encontrada", 
    path: req.originalUrl || req.url 
  });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[GLOBAL ERROR]", err);
  res.status(500).json({ 
    error: "Erro interno do servidor", 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

export default app;
