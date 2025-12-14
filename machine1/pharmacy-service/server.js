const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(bodyParser.json());

// Database setup
const dbPath = path.join(__dirname, "data", "pharmacy.db");
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log("[PHARMACY] Connected to SQLite database");
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Table des médicaments (inventaire)
    db.run(`CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genericName TEXT,
      dosage TEXT NOT NULL,
      form TEXT NOT NULL,
      manufacturer TEXT,
      category TEXT,
      requiresPrescription INTEGER DEFAULT 1,
      unitPrice REAL NOT NULL,
      stockQuantity INTEGER DEFAULT 0,
      minStockLevel INTEGER DEFAULT 10,
      expirationDate TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    )`);

    // Table des prescriptions
    db.run(`CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      patientCin TEXT NOT NULL,
      patientName TEXT NOT NULL,
      doctorId TEXT NOT NULL,
      doctorName TEXT NOT NULL,
      consultationId TEXT,
      prescriptionDate TEXT NOT NULL,
      expirationDate TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      notes TEXT,
      createdAt TEXT NOT NULL
    )`);

    // Table des items de prescription
    db.run(`CREATE TABLE IF NOT EXISTS prescription_items (
      id TEXT PRIMARY KEY,
      prescriptionId TEXT NOT NULL,
      medicationId TEXT NOT NULL,
      medicationName TEXT NOT NULL,
      dosage TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      frequency TEXT,
      duration TEXT,
      instructions TEXT,
      FOREIGN KEY (prescriptionId) REFERENCES prescriptions(id),
      FOREIGN KEY (medicationId) REFERENCES medications(id)
    )`);

    // Table des dispensations
    db.run(`CREATE TABLE IF NOT EXISTS dispensations (
      id TEXT PRIMARY KEY,
      prescriptionId TEXT,
      patientCin TEXT NOT NULL,
      pharmacistId TEXT,
      totalAmount REAL NOT NULL,
      paymentMethod TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'completed',
      dispensedAt TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (prescriptionId) REFERENCES prescriptions(id)
    )`);

    // Table des items dispensés
    db.run(
      `CREATE TABLE IF NOT EXISTS dispensation_items (
      id TEXT PRIMARY KEY,
      dispensationId TEXT NOT NULL,
      medicationId TEXT NOT NULL,
      medicationName TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unitPrice REAL NOT NULL,
      totalPrice REAL NOT NULL,
      FOREIGN KEY (dispensationId) REFERENCES dispensations(id),
      FOREIGN KEY (medicationId) REFERENCES medications(id)
    )`,
      (err) => {
        if (!err) initializeTestData();
      }
    );
  });
}

function initializeTestData() {
  db.get("SELECT COUNT(*) as count FROM medications", (err, row) => {
    if (err || row.count > 0) return;

    const medications = [
      {
        name: "Amlodipine",
        genericName: "Amlodipine Besylate",
        dosage: "5mg",
        form: "tablet",
        manufacturer: "Pfizer",
        category: "cardiovascular",
        requiresPrescription: 1,
        unitPrice: 2.5,
        stockQuantity: 500,
        minStockLevel: 50,
      },
      {
        name: "Aspirine",
        genericName: "Acide Acétylsalicylique",
        dosage: "100mg",
        form: "tablet",
        manufacturer: "Bayer",
        category: "analgesic",
        requiresPrescription: 0,
        unitPrice: 0.8,
        stockQuantity: 1000,
        minStockLevel: 100,
      },
      {
        name: "Metformine",
        genericName: "Metformin HCl",
        dosage: "500mg",
        form: "tablet",
        manufacturer: "Merck",
        category: "diabetes",
        requiresPrescription: 1,
        unitPrice: 1.2,
        stockQuantity: 800,
        minStockLevel: 80,
      },
      {
        name: "Oméprazole",
        genericName: "Omeprazole",
        dosage: "20mg",
        form: "capsule",
        manufacturer: "AstraZeneca",
        category: "gastro",
        requiresPrescription: 1,
        unitPrice: 3.5,
        stockQuantity: 300,
        minStockLevel: 30,
      },
      {
        name: "Paracétamol",
        genericName: "Acetaminophen",
        dosage: "500mg",
        form: "tablet",
        manufacturer: "Sanofi",
        category: "analgesic",
        requiresPrescription: 0,
        unitPrice: 0.5,
        stockQuantity: 2000,
        minStockLevel: 200,
      },
      {
        name: "Lisinopril",
        genericName: "Lisinopril",
        dosage: "10mg",
        form: "tablet",
        manufacturer: "Merck",
        category: "cardiovascular",
        requiresPrescription: 1,
        unitPrice: 4.0,
        stockQuantity: 400,
        minStockLevel: 40,
      },
      {
        name: "Amoxicilline",
        genericName: "Amoxicillin",
        dosage: "500mg",
        form: "capsule",
        manufacturer: "GSK",
        category: "antibiotic",
        requiresPrescription: 1,
        unitPrice: 2.0,
        stockQuantity: 600,
        minStockLevel: 60,
      },
      {
        name: "Ibuprofène",
        genericName: "Ibuprofen",
        dosage: "400mg",
        form: "tablet",
        manufacturer: "Advil",
        category: "analgesic",
        requiresPrescription: 0,
        unitPrice: 1.0,
        stockQuantity: 1500,
        minStockLevel: 150,
      },
    ];

    medications.forEach((med) => {
      const id = uuidv4();
      const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      db.run(
        `INSERT INTO medications (id, name, genericName, dosage, form, manufacturer, category, 
              requiresPrescription, unitPrice, stockQuantity, minStockLevel, expirationDate, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          med.name,
          med.genericName,
          med.dosage,
          med.form,
          med.manufacturer,
          med.category,
          med.requiresPrescription,
          med.unitPrice,
          med.stockQuantity,
          med.minStockLevel,
          expirationDate,
          new Date().toISOString(),
        ]
      );
    });
    console.log("[PHARMACY] Test medications initialized");
  });
}

// ============================================
// MEDICATIONS (INVENTORY) CRUD
// ============================================

// GET all medications
app.get("/api/medications", (req, res) => {
  const { category, lowStock, search } = req.query;
  let query = "SELECT * FROM medications WHERE 1=1";
  const params = [];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }
  if (lowStock === "true") {
    query += " AND stockQuantity <= minStockLevel";
  }
  if (search) {
    query += " AND (name LIKE ? OR genericName LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  db.all(query, params, (err, medications) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(medications);
  });
});

// GET medication by ID
app.get("/api/medications/:id", (req, res) => {
  db.get(
    "SELECT * FROM medications WHERE id = ?",
    [req.params.id],
    (err, medication) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!medication)
        return res.status(404).json({ error: "Medication not found" });
      res.json(medication);
    }
  );
});

// CREATE medication
app.post("/api/medications", (req, res) => {
  const {
    name,
    genericName,
    dosage,
    form,
    manufacturer,
    category,
    requiresPrescription,
    unitPrice,
    stockQuantity,
    minStockLevel,
    expirationDate,
  } = req.body;

  if (!name || !dosage || !form || !unitPrice) {
    return res
      .status(400)
      .json({
        error: "Missing required fields: name, dosage, form, unitPrice",
      });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO medications (id, name, genericName, dosage, form, manufacturer, category,
          requiresPrescription, unitPrice, stockQuantity, minStockLevel, expirationDate, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      genericName,
      dosage,
      form,
      manufacturer,
      category,
      requiresPrescription !== undefined ? requiresPrescription : 1,
      unitPrice,
      stockQuantity || 0,
      minStockLevel || 10,
      expirationDate,
      createdAt,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });
      db.get(
        "SELECT * FROM medications WHERE id = ?",
        [id],
        (err, medication) => {
          res.status(201).json(medication);
        }
      );
    }
  );
});

// UPDATE medication (stock, price, etc.)
app.put("/api/medications/:id", (req, res) => {
  const { stockQuantity, unitPrice, minStockLevel, expirationDate } = req.body;

  const updates = [];
  const params = [];

  if (stockQuantity !== undefined) {
    updates.push("stockQuantity = ?");
    params.push(stockQuantity);
  }
  if (unitPrice !== undefined) {
    updates.push("unitPrice = ?");
    params.push(unitPrice);
  }
  if (minStockLevel !== undefined) {
    updates.push("minStockLevel = ?");
    params.push(minStockLevel);
  }
  if (expirationDate) {
    updates.push("expirationDate = ?");
    params.push(expirationDate);
  }

  updates.push("updatedAt = ?");
  params.push(new Date().toISOString());
  params.push(req.params.id);

  db.run(
    `UPDATE medications SET ${updates.join(", ")} WHERE id = ?`,
    params,
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });
      if (this.changes === 0)
        return res.status(404).json({ error: "Medication not found" });

      db.get(
        "SELECT * FROM medications WHERE id = ?",
        [req.params.id],
        (err, medication) => {
          res.json(medication);
        }
      );
    }
  );
});

// Adjust stock (add/remove)
app.post("/api/medications/:id/stock", (req, res) => {
  const { adjustment, reason } = req.body;

  if (adjustment === undefined) {
    return res
      .status(400)
      .json({
        error: "adjustment is required (positive to add, negative to remove)",
      });
  }

  db.get(
    "SELECT * FROM medications WHERE id = ?",
    [req.params.id],
    (err, medication) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!medication)
        return res.status(404).json({ error: "Medication not found" });

      const newStock = medication.stockQuantity + adjustment;
      if (newStock < 0) {
        return res
          .status(400)
          .json({
            error: "Insufficient stock",
            currentStock: medication.stockQuantity,
          });
      }

      db.run(
        "UPDATE medications SET stockQuantity = ?, updatedAt = ? WHERE id = ?",
        [newStock, new Date().toISOString(), req.params.id],
        function (err) {
          if (err) return res.status(500).json({ error: "Database error" });
          res.json({
            medicationId: req.params.id,
            medicationName: medication.name,
            previousStock: medication.stockQuantity,
            adjustment,
            newStock,
            reason: reason || "manual adjustment",
          });
        }
      );
    }
  );
});

// DELETE medication
app.delete("/api/medications/:id", (req, res) => {
  db.run(
    "DELETE FROM medications WHERE id = ?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });
      if (this.changes === 0)
        return res.status(404).json({ error: "Medication not found" });
      res.json({ success: true, message: "Medication deleted" });
    }
  );
});

// ============================================
// PRESCRIPTIONS CRUD
// ============================================

// GET all prescriptions
app.get("/api/prescriptions", (req, res) => {
  const { patientCin, status, doctorId } = req.query;
  let query = "SELECT * FROM prescriptions WHERE 1=1";
  const params = [];

  if (patientCin) {
    query += " AND patientCin = ?";
    params.push(patientCin);
  }
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  if (doctorId) {
    query += " AND doctorId = ?";
    params.push(doctorId);
  }

  query += " ORDER BY prescriptionDate DESC";

  db.all(query, params, (err, prescriptions) => {
    if (err) return res.status(500).json({ error: "Database error" });

    // Get items for each prescription
    const result = [];
    let completed = 0;

    if (prescriptions.length === 0) return res.json([]);

    prescriptions.forEach((prescription) => {
      db.all(
        "SELECT * FROM prescription_items WHERE prescriptionId = ?",
        [prescription.id],
        (err, items) => {
          prescription.items = items || [];
          result.push(prescription);
          completed++;
          if (completed === prescriptions.length) {
            res.json(result);
          }
        }
      );
    });
  });
});

// GET prescription by ID
app.get("/api/prescriptions/:id", (req, res) => {
  db.get(
    "SELECT * FROM prescriptions WHERE id = ?",
    [req.params.id],
    (err, prescription) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!prescription)
        return res.status(404).json({ error: "Prescription not found" });

      db.all(
        "SELECT * FROM prescription_items WHERE prescriptionId = ?",
        [prescription.id],
        (err, items) => {
          prescription.items = items || [];
          res.json(prescription);
        }
      );
    }
  );
});

// CREATE prescription
app.post("/api/prescriptions", (req, res) => {
  const {
    patientCin,
    patientName,
    doctorId,
    doctorName,
    consultationId,
    items,
    notes,
  } = req.body;

  if (!patientCin || !doctorId || !items || items.length === 0) {
    return res
      .status(400)
      .json({ error: "Missing required fields: patientCin, doctorId, items" });
  }

  const id = uuidv4();
  const prescriptionDate = new Date().toISOString();
  const expirationDate = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString(); // 30 days validity
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO prescriptions (id, patientCin, patientName, doctorId, doctorName, 
          consultationId, prescriptionDate, expirationDate, status, notes, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      id,
      patientCin,
      patientName || "",
      doctorId,
      doctorName || "",
      consultationId,
      prescriptionDate,
      expirationDate,
      notes,
      createdAt,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });

      // Insert prescription items
      items.forEach((item) => {
        const itemId = uuidv4();
        db.run(
          `INSERT INTO prescription_items (id, prescriptionId, medicationId, medicationName,
                dosage, quantity, frequency, duration, instructions)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            id,
            item.medicationId || "",
            item.medicationName,
            item.dosage,
            item.quantity,
            item.frequency,
            item.duration,
            item.instructions,
          ]
        );
      });

      res.status(201).json({
        id,
        patientCin,
        patientName,
        doctorId,
        doctorName,
        prescriptionDate,
        expirationDate,
        status: "active",
        items,
        message: "Prescription created successfully",
      });
    }
  );
});

// UPDATE prescription status
app.put("/api/prescriptions/:id", (req, res) => {
  const { status } = req.body;

  if (!["active", "dispensed", "expired", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  db.run(
    "UPDATE prescriptions SET status = ? WHERE id = ?",
    [status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });
      if (this.changes === 0)
        return res.status(404).json({ error: "Prescription not found" });

      db.get(
        "SELECT * FROM prescriptions WHERE id = ?",
        [req.params.id],
        (err, prescription) => {
          res.json(prescription);
        }
      );
    }
  );
});

// ============================================
// DISPENSATIONS (SALES)
// ============================================

// GET all dispensations
app.get("/api/dispensations", (req, res) => {
  const { patientCin, startDate, endDate } = req.query;
  let query = "SELECT * FROM dispensations WHERE 1=1";
  const params = [];

  if (patientCin) {
    query += " AND patientCin = ?";
    params.push(patientCin);
  }
  if (startDate) {
    query += " AND dispensedAt >= ?";
    params.push(startDate);
  }
  if (endDate) {
    query += " AND dispensedAt <= ?";
    params.push(endDate);
  }

  query += " ORDER BY dispensedAt DESC";

  db.all(query, params, (err, dispensations) => {
    if (err) return res.status(500).json({ error: "Database error" });

    if (dispensations.length === 0) return res.json([]);

    let completed = 0;
    dispensations.forEach((disp) => {
      db.all(
        "SELECT * FROM dispensation_items WHERE dispensationId = ?",
        [disp.id],
        (err, items) => {
          disp.items = items || [];
          completed++;
          if (completed === dispensations.length) {
            res.json(dispensations);
          }
        }
      );
    });
  });
});

// CREATE dispensation (sell medications)
app.post("/api/dispensations", (req, res) => {
  const {
    prescriptionId,
    patientCin,
    pharmacistId,
    items,
    paymentMethod,
    notes,
  } = req.body;

  if (!patientCin || !items || items.length === 0) {
    return res
      .status(400)
      .json({ error: "Missing required fields: patientCin, items" });
  }

  // Verify stock and calculate total
  const stockChecks = items.map((item) => {
    return new Promise((resolve, reject) => {
      if (!item.medicationId) {
        return reject(new Error("medicationId is required for each item"));
      }
      db.get(
        "SELECT * FROM medications WHERE id = ?",
        [item.medicationId],
        (err, medication) => {
          if (err) return reject(err);
          if (!medication)
            return reject(
              new Error(`Medication ${item.medicationId} not found`)
            );
          if (medication.stockQuantity < item.quantity) {
            return reject(
              new Error(
                `Insufficient stock for ${medication.name}. Available: ${medication.stockQuantity}`
              )
            );
          }
          resolve({
            ...item,
            medicationName: medication.name,
            unitPrice: medication.unitPrice,
            totalPrice: medication.unitPrice * item.quantity,
          });
        }
      );
    });
  });

  Promise.all(stockChecks)
    .then((processedItems) => {
      const totalAmount = processedItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );
      const id = uuidv4();
      const dispensedAt = new Date().toISOString();

      db.run(
        `INSERT INTO dispensations (id, prescriptionId, patientCin, pharmacistId, 
              totalAmount, paymentMethod, status, dispensedAt, notes)
              VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
        [
          id,
          prescriptionId,
          patientCin,
          pharmacistId,
          totalAmount,
          paymentMethod || "cash",
          dispensedAt,
          notes,
        ],
        function (err) {
          if (err) return res.status(500).json({ error: "Database error" });

          // Insert items and update stock
          processedItems.forEach((item) => {
            const itemId = uuidv4();
            db.run(
              `INSERT INTO dispensation_items (id, dispensationId, medicationId, medicationName,
                    quantity, unitPrice, totalPrice)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                itemId,
                id,
                item.medicationId,
                item.medicationName,
                item.quantity,
                item.unitPrice,
                item.totalPrice,
              ]
            );

            // Reduce stock
            db.run(
              "UPDATE medications SET stockQuantity = stockQuantity - ? WHERE id = ?",
              [item.quantity, item.medicationId]
            );
          });

          // Update prescription status if provided
          if (prescriptionId) {
            db.run(
              "UPDATE prescriptions SET status = 'dispensed' WHERE id = ?",
              [prescriptionId]
            );
          }

          res.status(201).json({
            id,
            prescriptionId,
            patientCin,
            items: processedItems,
            totalAmount,
            paymentMethod: paymentMethod || "cash",
            dispensedAt,
            message: `Dispensation completed. Total: ${totalAmount.toFixed(
              2
            )} TND`,
          });
        }
      );
    })
    .catch((error) => {
      res.status(400).json({ error: error.message });
    });
});

// ============================================
// REPORTS
// ============================================

// Low stock report
app.get("/api/reports/low-stock", (req, res) => {
  db.all(
    "SELECT * FROM medications WHERE stockQuantity <= minStockLevel ORDER BY stockQuantity ASC",
    (err, medications) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({
        count: medications.length,
        medications,
        message:
          medications.length > 0
            ? "Stock replenishment needed"
            : "All stock levels are adequate",
      });
    }
  );
});

// Expiring medications report
app.get("/api/reports/expiring", (req, res) => {
  const thresholdDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]; // 90 days

  db.all(
    "SELECT * FROM medications WHERE expirationDate <= ? AND stockQuantity > 0 ORDER BY expirationDate ASC",
    [thresholdDate],
    (err, medications) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({
        count: medications.length,
        thresholdDays: 90,
        medications,
      });
    }
  );
});

// ============================================
// HEALTH CHECK
// ============================================

app.get("/health", (req, res) => {
  res.json({ status: "UP", service: "pharmacy-service" });
});

app.get("/actuator/health", (req, res) => {
  res.json({ status: "UP", service: "pharmacy-service" });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[PHARMACY] Service running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  db.close();
  process.exit(0);
});
