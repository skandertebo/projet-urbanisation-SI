const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database setup
const dbPath = path.join(__dirname, 'data', 'patients.db');
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create patients table
    db.run(`CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cin TEXT UNIQUE NOT NULL,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      dateOfBirth TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating patients table:', err);
      }
    });

    // Create allergies table
    db.run(`CREATE TABLE IF NOT EXISTS patient_allergies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      allergy TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating allergies table:', err);
      }
    });

    // Create medical_history table
    db.run(`CREATE TABLE IF NOT EXISTS patient_medical_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      history TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id)
    )`, (err) => {
      if (err) {
        console.error('Error creating medical_history table:', err);
      } else {
        // Initialize test data
        initializeTestData();
      }
    });
  });
}

function initializeTestData() {
  db.get('SELECT COUNT(*) as count FROM patients', (err, row) => {
    if (err) {
      console.error('Error checking patients count:', err);
      return;
    }
    
    if (row.count === 0) {
      const patient = {
        cin: '12345678',
        firstName: 'Ahmed',
        lastName: 'Tounsi',
        dateOfBirth: '1980-05-15',
        email: 'ahmed.tounsi@example.com',
        phone: '+216 12 345 678',
        address: 'Tunis, Tunisie',
        allergies: ['Pénicilline', 'Aspirine'],
        medicalHistory: ['Hypertension', 'Diabète type 2']
      };
      
      db.run(`INSERT INTO patients (cin, firstName, lastName, dateOfBirth, email, phone, address)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [patient.cin, patient.firstName, patient.lastName, patient.dateOfBirth,
         patient.email, patient.phone, patient.address],
        function(err) {
          if (err) {
            console.error('Error inserting patient:', err);
          } else {
            const patientId = this.lastID;
            // Insert allergies
            patient.allergies.forEach(allergy => {
              db.run('INSERT INTO patient_allergies (patient_id, allergy) VALUES (?, ?)',
                [patientId, allergy]);
            });
            // Insert medical history
            patient.medicalHistory.forEach(history => {
              db.run('INSERT INTO patient_medical_history (patient_id, history) VALUES (?, ?)',
                [patientId, history]);
            });
            console.log('Test patient created: Ahmed Tounsi (CIN: 12345678)');
          }
        });
    }
  });
}

// Helper function to get patient with allergies and medical history
function getPatientWithDetails(patientId, callback) {
  db.get('SELECT * FROM patients WHERE id = ?', [patientId], (err, patient) => {
    if (err || !patient) {
      callback(err, null);
      return;
    }
    
    db.all('SELECT allergy FROM patient_allergies WHERE patient_id = ?', [patientId], (err, allergies) => {
      if (err) {
        callback(err, null);
        return;
      }
      
      db.all('SELECT history FROM patient_medical_history WHERE patient_id = ?', [patientId], (err, history) => {
        if (err) {
          callback(err, null);
          return;
        }
        
        patient.allergies = allergies.map(a => a.allergy);
        patient.medicalHistory = history.map(h => h.history);
        callback(null, patient);
      });
    });
  });
}

// Health check endpoint
app.get('/actuator/health', (req, res) => {
  res.json({ status: 'UP' });
});

// Get patient by ID
app.get('/api/patients/:id', (req, res) => {
  const id = parseInt(req.params.id);
  getPatientWithDetails(id, (err, patient) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
    } else {
      res.json(patient);
    }
  });
});

// Get patient by CIN
app.get('/api/patients/cin/:cin', (req, res) => {
  const cin = req.params.cin;
  db.get('SELECT * FROM patients WHERE cin = ?', [cin], (err, patient) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
    } else {
      getPatientWithDetails(patient.id, (err, fullPatient) => {
        if (err) {
          res.status(500).json({ error: 'Database error' });
        } else {
          res.json(fullPatient);
        }
      });
    }
  });
});

// Search patient by name
app.get('/api/patients/search', (req, res) => {
  const { firstName, lastName } = req.query;
  
  if (!firstName || !lastName) {
    res.status(400).json({ error: 'firstName and lastName are required' });
    return;
  }
  
  db.get('SELECT * FROM patients WHERE firstName = ? AND lastName = ?',
    [firstName, lastName], (err, patient) => {
      if (err) {
        res.status(500).json({ error: 'Database error' });
      } else if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
      } else {
        getPatientWithDetails(patient.id, (err, fullPatient) => {
          if (err) {
            res.status(500).json({ error: 'Database error' });
          } else {
            res.json(fullPatient);
          }
        });
      }
    });
});

// Create patient
app.post('/api/patients', (req, res) => {
  const { cin, firstName, lastName, dateOfBirth, email, phone, address, allergies, medicalHistory } = req.body;
  
  if (!cin || !firstName || !lastName || !dateOfBirth) {
    res.status(400).json({ error: 'cin, firstName, lastName, and dateOfBirth are required' });
    return;
  }
  
  db.run(`INSERT INTO patients (cin, firstName, lastName, dateOfBirth, email, phone, address)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [cin, firstName, lastName, dateOfBirth, email || null, phone || null, address || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          res.status(409).json({ error: 'Patient with this CIN already exists' });
        } else {
          res.status(500).json({ error: 'Database error' });
        }
      } else {
        const patientId = this.lastID;
        
        // Insert allergies
        if (allergies && Array.isArray(allergies)) {
          allergies.forEach(allergy => {
            db.run('INSERT INTO patient_allergies (patient_id, allergy) VALUES (?, ?)',
              [patientId, allergy]);
          });
        }
        
        // Insert medical history
        if (medicalHistory && Array.isArray(medicalHistory)) {
          medicalHistory.forEach(history => {
            db.run('INSERT INTO patient_medical_history (patient_id, history) VALUES (?, ?)',
              [patientId, history]);
          });
        }
        
        getPatientWithDetails(patientId, (err, patient) => {
          if (err) {
            res.status(500).json({ error: 'Database error' });
          } else {
            res.status(201).json(patient);
          }
        });
      }
    });
});

// Get all patients
app.get('/api/patients', (req, res) => {
  db.all('SELECT * FROM patients', (err, patients) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      // Get details for each patient
      const patientsWithDetails = [];
      let completed = 0;
      
      if (patients.length === 0) {
        res.json([]);
        return;
      }
      
      patients.forEach(patient => {
        getPatientWithDetails(patient.id, (err, fullPatient) => {
          if (!err && fullPatient) {
            patientsWithDetails.push(fullPatient);
          }
          completed++;
          if (completed === patients.length) {
            res.json(patientsWithDetails);
          }
        });
      });
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Patient Core Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});


