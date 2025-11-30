const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Service URLs from environment or defaults
const PATIENT_SERVICE_URL = process.env.PATIENT_SERVICE_URL || 'http://patient-core-service:8080';
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://billing-service:3000';

// Health check
app.get('/actuator/health', (req, res) => {
  res.json({ status: 'UP' });
});

// Route: Search patient
app.get('/api/patient/search', async (req, res) => {
  const { cin } = req.query;
  
  if (!cin) {
    return res.status(400).json({ error: 'CIN parameter is required' });
  }
  
  try {
    console.log(`ESB Central: Recherche de patient - CIN: ${cin}`);
    const response = await axios.get(`${PATIENT_SERVICE_URL}/api/patients/cin/${cin}`);
    console.log('ESB Central: Patient trouvé au siège');
    res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('ESB Central: Patient non trouvé');
      res.status(404).json({ error: 'Patient non trouvé' });
    } else {
      console.error('ESB Central: Erreur lors de la recherche:', error.message);
      res.status(500).json({ error: 'Erreur lors de la recherche du patient' });
    }
  }
});

// Route: Create patient
app.post('/api/patient/create', async (req, res) => {
  try {
    console.log('ESB Central: Création de patient');
    const response = await axios.post(`${PATIENT_SERVICE_URL}/api/patients`, req.body);
    console.log('ESB Central: Patient créé avec succès');
    res.status(201).json(response.data);
  } catch (error) {
    console.error('ESB Central: Erreur lors de la création:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Erreur lors de la création du patient' 
    });
  }
});

// Route: Generate invoice
app.post('/api/billing/generate', async (req, res) => {
  try {
    console.log('ESB Central: Génération de facture');
    const response = await axios.post(`${BILLING_SERVICE_URL}/api/billing/generate`, req.body);
    console.log('ESB Central: Facture générée avec succès');
    res.json(response.data);
  } catch (error) {
    console.error('ESB Central: Erreur lors de la génération:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Erreur lors de la génération de la facture' 
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ESB Central running on port ${PORT}`);
  console.log(`Patient Service URL: ${PATIENT_SERVICE_URL}`);
  console.log(`Billing Service URL: ${BILLING_SERVICE_URL}`);
});

