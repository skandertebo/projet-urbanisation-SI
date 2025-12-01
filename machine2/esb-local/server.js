const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8082;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Service URLs from environment or defaults
const CARDIO_SERVICE_URL = process.env.CARDIO_SERVICE_URL || 'http://cardio-consultation-service:5000';
const ESB_CENTRAL_URL = process.env.ESB_CENTRAL_URL || 'http://esb-central:8081';

// Health check
app.get('/actuator/health', (req, res) => {
  res.json({ status: 'UP' });
});

// Route: Patient check-in (admission patient)
// Implements: local search -> if not found -> central search -> synchronization
app.get('/api/checkin', async (req, res) => {
  const { cin } = req.query;
  
  if (!cin) {
    return res.status(400).json({ error: 'CIN parameter is required' });
  }
  
  try {
    console.log(`ESB Local: Check-in patient - CIN: ${cin}`);
    
    // Step 1: Search locally
    try {
      const localResponse = await axios.get(`${CARDIO_SERVICE_URL}/api/local_patient/cin/${cin}`);
      console.log('ESB Local: Patient trouvé localement');
      return res.json(localResponse.data);
    } catch (localError) {
      if (localError.response && localError.response.status === 404) {
        console.log('ESB Local: Patient non trouvé localement, recherche au siège...');
        
        // Step 2: Search at central (siège)
        try {
          const centralResponse = await axios.get(`${ESB_CENTRAL_URL}/api/patient/search?cin=${cin}`);
          console.log('ESB Local: Patient trouvé au siège, synchronisation...');
          
          // Step 3: Synchronize to local database
          try {
            await axios.post(`${CARDIO_SERVICE_URL}/api/local_patient`, centralResponse.data);
            console.log('ESB Local: Patient synchronisé avec succès');
            return res.json(centralResponse.data);
          } catch (syncError) {
            console.error('ESB Local: Erreur lors de la synchronisation:', syncError.message);
            // Return patient data even if sync fails
            return res.json(centralResponse.data);
          }
        } catch (centralError) {
          if (centralError.response && centralError.response.status === 404) {
            console.log('ESB Local: Patient non trouvé nulle part');
            return res.status(404).json({ error: 'Patient non trouvé' });
          } else {
            console.error('ESB Local: Erreur lors de la recherche au siège:', centralError.message);
            return res.status(500).json({ error: 'Erreur lors de la recherche au siège' });
          }
        }
      } else {
        console.error('ESB Local: Erreur lors de la recherche locale:', localError.message);
        return res.status(500).json({ error: 'Erreur lors de la recherche locale' });
      }
    }
  } catch (error) {
    console.error('ESB Local: Erreur inattendue:', error.message);
    res.status(500).json({ error: 'Erreur inattendue' });
  }
});

// Route: Get consultations for a patient
app.get('/api/consultation/patient/:patientId', async (req, res) => {
  const { patientId } = req.params;
  
  try {
    console.log(`ESB Local: Récupération consultations pour patient ${patientId}`);
    const response = await axios.get(`${CARDIO_SERVICE_URL}/api/consultation/patient/${patientId}`);
    console.log('ESB Local: Consultations récupérées');
    res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      res.status(404).json({ error: 'Consultations non trouvées' });
    } else {
      console.error('ESB Local: Erreur lors de la récupération:', error.message);
      res.status(500).json({ error: 'Erreur lors de la récupération des consultations' });
    }
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ESB Local running on port ${PORT}`);
  console.log(`Cardio Service URL: ${CARDIO_SERVICE_URL}`);
  console.log(`ESB Central URL: ${ESB_CENTRAL_URL}`);
});


