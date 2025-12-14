const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());

// Database setup
const dbPath = path.join(__dirname, 'data', 'insurance.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('[INSURANCE] Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Table des contrats d'assurance
    db.run(`CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      patientCin TEXT NOT NULL,
      patientName TEXT NOT NULL,
      insurerName TEXT NOT NULL,
      policyNumber TEXT UNIQUE NOT NULL,
      coverageType TEXT NOT NULL,
      coveragePercentage INTEGER DEFAULT 80,
      maxAnnualAmount REAL DEFAULT 5000,
      usedAmount REAL DEFAULT 0,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL
    )`);

    // Table des réclamations (claims)
    db.run(`CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      contractId TEXT NOT NULL,
      invoiceNumber TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      coveredAmount REAL NOT NULL,
      patientShare REAL NOT NULL,
      acts TEXT,
      status TEXT DEFAULT 'pending',
      submittedAt TEXT NOT NULL,
      processedAt TEXT,
      reimbursementDate TEXT,
      rejectionReason TEXT,
      FOREIGN KEY (contractId) REFERENCES contracts(id)
    )`);

    // Table des remboursements
    db.run(`CREATE TABLE IF NOT EXISTS reimbursements (
      id TEXT PRIMARY KEY,
      claimId TEXT NOT NULL,
      amount REAL NOT NULL,
      paymentMethod TEXT DEFAULT 'bank_transfer',
      bankAccount TEXT,
      processedAt TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      FOREIGN KEY (claimId) REFERENCES claims(id)
    )`, (err) => {
      if (!err) initializeTestData();
    });
  });
}

function initializeTestData() {
  db.get('SELECT COUNT(*) as count FROM contracts', (err, row) => {
    if (err || row.count > 0) return;

    const contracts = [
      {
        id: uuidv4(),
        patientCin: '12345678',
        patientName: 'Ahmed Tounsi',
        insurerName: 'CNAM Tunisie',
        policyNumber: 'CNAM-2024-001234',
        coverageType: 'complete',
        coveragePercentage: 70,
        maxAnnualAmount: 3000,
        usedAmount: 450,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: uuidv4(),
        patientCin: '12345678',
        patientName: 'Ahmed Tounsi',
        insurerName: 'Assurances STAR',
        policyNumber: 'STAR-MED-2024-5678',
        coverageType: 'complementary',
        coveragePercentage: 20,
        maxAnnualAmount: 2000,
        usedAmount: 120,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];

    contracts.forEach(contract => {
      db.run(`INSERT INTO contracts (id, patientCin, patientName, insurerName, policyNumber, 
              coverageType, coveragePercentage, maxAnnualAmount, usedAmount, startDate, endDate, status, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [contract.id, contract.patientCin, contract.patientName, contract.insurerName,
         contract.policyNumber, contract.coverageType, contract.coveragePercentage,
         contract.maxAnnualAmount, contract.usedAmount, contract.startDate, contract.endDate,
         contract.status, contract.createdAt]);
    });
    console.log('[INSURANCE] Test data initialized');
  });
}

// ============================================
// CONTRACTS CRUD
// ============================================

// GET all contracts
app.get('/api/contracts', (req, res) => {
  const { patientCin, status } = req.query;
  let query = 'SELECT * FROM contracts WHERE 1=1';
  const params = [];

  if (patientCin) {
    query += ' AND patientCin = ?';
    params.push(patientCin);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  db.all(query, params, (err, contracts) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(contracts);
  });
});

// GET contract by ID
app.get('/api/contracts/:id', (req, res) => {
  db.get('SELECT * FROM contracts WHERE id = ?', [req.params.id], (err, contract) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  });
});

// CREATE contract
app.post('/api/contracts', (req, res) => {
  const { patientCin, patientName, insurerName, policyNumber, coverageType,
          coveragePercentage, maxAnnualAmount, startDate, endDate } = req.body;

  if (!patientCin || !insurerName || !policyNumber || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();

  db.run(`INSERT INTO contracts (id, patientCin, patientName, insurerName, policyNumber,
          coverageType, coveragePercentage, maxAnnualAmount, startDate, endDate, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, patientCin, patientName || '', insurerName, policyNumber,
     coverageType || 'basic', coveragePercentage || 80, maxAnnualAmount || 5000,
     startDate, endDate, createdAt],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Policy number already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      db.get('SELECT * FROM contracts WHERE id = ?', [id], (err, contract) => {
        res.status(201).json(contract);
      });
    });
});

// UPDATE contract
app.put('/api/contracts/:id', (req, res) => {
  const { status, usedAmount, coveragePercentage, maxAnnualAmount, endDate } = req.body;
  
  const updates = [];
  const params = [];
  
  if (status) { updates.push('status = ?'); params.push(status); }
  if (usedAmount !== undefined) { updates.push('usedAmount = ?'); params.push(usedAmount); }
  if (coveragePercentage) { updates.push('coveragePercentage = ?'); params.push(coveragePercentage); }
  if (maxAnnualAmount) { updates.push('maxAnnualAmount = ?'); params.push(maxAnnualAmount); }
  if (endDate) { updates.push('endDate = ?'); params.push(endDate); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(req.params.id);

  db.run(`UPDATE contracts SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Contract not found' });
    
    db.get('SELECT * FROM contracts WHERE id = ?', [req.params.id], (err, contract) => {
      res.json(contract);
    });
  });
});

// DELETE contract
app.delete('/api/contracts/:id', (req, res) => {
  db.run('DELETE FROM contracts WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json({ success: true, message: 'Contract deleted' });
  });
});

// ============================================
// COVERAGE VERIFICATION
// ============================================

app.get('/api/coverage/verify', (req, res) => {
  const { patientCin, amount } = req.query;

  if (!patientCin) {
    return res.status(400).json({ error: 'patientCin is required' });
  }

  const requestedAmount = parseFloat(amount) || 0;

  db.all(`SELECT * FROM contracts WHERE patientCin = ? AND status = 'active' 
          AND date('now') BETWEEN startDate AND endDate`, [patientCin], (err, contracts) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (contracts.length === 0) {
      return res.json({
        covered: false,
        message: 'No active insurance coverage found',
        patientShare: requestedAmount,
        insuranceShare: 0
      });
    }

    let totalCoverage = 0;
    const coverageDetails = contracts.map(contract => {
      const remainingBudget = contract.maxAnnualAmount - contract.usedAmount;
      const potentialCoverage = Math.min(
        requestedAmount * (contract.coveragePercentage / 100),
        remainingBudget
      );
      totalCoverage += potentialCoverage;

      return {
        insurer: contract.insurerName,
        policyNumber: contract.policyNumber,
        coverageType: contract.coverageType,
        coveragePercentage: contract.coveragePercentage,
        remainingBudget: remainingBudget,
        potentialCoverage: potentialCoverage
      };
    });

    res.json({
      covered: totalCoverage > 0,
      patientCin,
      requestedAmount,
      insuranceShare: Math.min(totalCoverage, requestedAmount),
      patientShare: Math.max(0, requestedAmount - totalCoverage),
      coverageDetails
    });
  });
});

// ============================================
// CLAIMS CRUD
// ============================================

// GET all claims
app.get('/api/claims', (req, res) => {
  const { contractId, status } = req.query;
  let query = `SELECT c.*, ct.patientCin, ct.insurerName, ct.policyNumber 
               FROM claims c JOIN contracts ct ON c.contractId = ct.id WHERE 1=1`;
  const params = [];

  if (contractId) { query += ' AND c.contractId = ?'; params.push(contractId); }
  if (status) { query += ' AND c.status = ?'; params.push(status); }

  db.all(query, params, (err, claims) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(claims.map(c => ({ ...c, acts: JSON.parse(c.acts || '[]') })));
  });
});

// CREATE claim (submit for reimbursement)
app.post('/api/claims', (req, res) => {
  const { contractId, invoiceNumber, totalAmount, acts } = req.body;

  if (!contractId || !invoiceNumber || !totalAmount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get contract to calculate coverage
  db.get('SELECT * FROM contracts WHERE id = ? AND status = ?', [contractId, 'active'], (err, contract) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!contract) return res.status(404).json({ error: 'Active contract not found' });

    const remainingBudget = contract.maxAnnualAmount - contract.usedAmount;
    const coveredAmount = Math.min(
      totalAmount * (contract.coveragePercentage / 100),
      remainingBudget
    );
    const patientShare = totalAmount - coveredAmount;

    const id = uuidv4();
    const submittedAt = new Date().toISOString();

    db.run(`INSERT INTO claims (id, contractId, invoiceNumber, totalAmount, coveredAmount, 
            patientShare, acts, status, submittedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, contractId, invoiceNumber, totalAmount, coveredAmount, patientShare,
       JSON.stringify(acts || []), submittedAt],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });

        res.status(201).json({
          id,
          contractId,
          invoiceNumber,
          totalAmount,
          coveredAmount,
          patientShare,
          acts: acts || [],
          status: 'pending',
          submittedAt,
          message: `Claim submitted. Covered: ${coveredAmount.toFixed(2)} TND, Patient pays: ${patientShare.toFixed(2)} TND`
        });
      });
  });
});

// Process claim (approve/reject)
app.put('/api/claims/:id/process', (req, res) => {
  const { action, rejectionReason } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }

  db.get('SELECT c.*, ct.id as contractId FROM claims c JOIN contracts ct ON c.contractId = ct.id WHERE c.id = ?',
    [req.params.id], (err, claim) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!claim) return res.status(404).json({ error: 'Claim not found' });
      if (claim.status !== 'pending') {
        return res.status(400).json({ error: 'Claim already processed' });
      }

      const processedAt = new Date().toISOString();
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      db.run(`UPDATE claims SET status = ?, processedAt = ?, rejectionReason = ? WHERE id = ?`,
        [newStatus, processedAt, action === 'reject' ? rejectionReason : null, req.params.id],
        function(err) {
          if (err) return res.status(500).json({ error: 'Database error' });

          // If approved, update contract used amount
          if (action === 'approve') {
            db.run('UPDATE contracts SET usedAmount = usedAmount + ? WHERE id = ?',
              [claim.coveredAmount, claim.contractId]);
          }

          res.json({
            id: claim.id,
            status: newStatus,
            processedAt,
            coveredAmount: action === 'approve' ? claim.coveredAmount : 0,
            message: action === 'approve' 
              ? `Claim approved. ${claim.coveredAmount.toFixed(2)} TND will be reimbursed.`
              : `Claim rejected: ${rejectionReason}`
          });
        });
    });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'insurance-service' });
});

app.get('/actuator/health', (req, res) => {
  res.json({ status: 'UP', service: 'insurance-service' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[INSURANCE] Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

