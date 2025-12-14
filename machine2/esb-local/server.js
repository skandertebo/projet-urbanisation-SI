const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 8082;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Service URLs from environment or defaults
const CARDIO_SERVICE_URL =
  process.env.CARDIO_SERVICE_URL || "http://cardio-consultation-service:5000";
const ESB_CENTRAL_URL =
  process.env.ESB_CENTRAL_URL || "http://esb-central:8081";

// ============================================
// ENDPOINT: RECHERCHE PATIENT (avec sync automatique)
// ============================================
app.get("/api/patient/search", async (req, res) => {
  const { cin } = req.query;

  if (!cin) {
    return res.status(400).json({ error: "CIN parameter is required" });
  }

  console.log(`[ESB-LOCAL] Recherche patient - CIN: ${cin}`);

  // Étape 1: Rechercher localement
  try {
    console.log("[ESB-LOCAL] Étape 1: Recherche locale...");
    const localResponse = await axios.get(
      `${CARDIO_SERVICE_URL}/api/local_patient/cin/${cin}`
    );
    console.log("[ESB-LOCAL] Patient trouvé localement");
    return res.json(localResponse.data);
  } catch (localError) {
    if (localError.response && localError.response.status === 404) {
      console.log(
        "[ESB-LOCAL] Patient non trouvé localement, recherche au siège..."
      );

      // Étape 2: Rechercher au siège via ESB-Central
      try {
        console.log("[ESB-LOCAL] Étape 2: Appel ESB-Central...");
        const centralResponse = await axios.get(
          `${ESB_CENTRAL_URL}/api/patient/search`,
          {
            params: { cin },
          }
        );

        console.log(
          "[ESB-LOCAL] Patient trouvé au siège, synchronisation locale..."
        );
        const patientFromCentral = centralResponse.data;

        // Étape 3: Synchroniser vers la base locale
        try {
          await axios.post(
            `${CARDIO_SERVICE_URL}/api/local_patient`,
            patientFromCentral
          );
          console.log("[ESB-LOCAL] Patient synchronisé localement avec succès");
        } catch (syncError) {
          console.error("[ESB-LOCAL] Erreur sync locale:", syncError.message);
          // On retourne quand même le patient même si la sync locale échoue
        }

        return res.json(patientFromCentral);
      } catch (centralError) {
        if (centralError.response && centralError.response.status === 404) {
          console.log("[ESB-LOCAL] Patient non trouvé au siège non plus");
          return res.status(404).json({ error: "Patient non trouvé" });
        } else {
          console.error(
            "[ESB-LOCAL] Erreur ESB-Central:",
            centralError.message
          );
          return res
            .status(500)
            .json({ error: "Erreur communication avec le siège" });
        }
      }
    } else {
      console.error("[ESB-LOCAL] Erreur recherche locale:", localError.message);
      return res.status(500).json({ error: "Erreur recherche locale" });
    }
  }
});

// ============================================
// ENDPOINT: SYNC PATIENT VERS LE SIÈGE
// ============================================
app.post("/api/patient/sync-to-central", async (req, res) => {
  const patientData = req.body;

  if (!patientData || !patientData.cin) {
    return res.status(400).json({ error: "Patient data with CIN is required" });
  }

  console.log(
    `[ESB-LOCAL] Synchronisation patient vers siège - CIN: ${patientData.cin}`
  );

  try {
    // Appeler ESB-Central pour créer le patient au siège
    const response = await axios.post(`${ESB_CENTRAL_URL}/api/patient/create`, {
      cin: patientData.cin,
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      dateOfBirth: patientData.dateOfBirth,
      email: patientData.email,
      phone: patientData.phone,
      address: patientData.address,
      allergies: patientData.allergies,
      medicalHistory: patientData.medicalHistory,
    });

    console.log("[ESB-LOCAL] Patient créé au siège avec succès");
    return res.status(201).json({
      success: true,
      message: "Patient synchronisé avec le siège",
      centralId: response.data.id,
      centralPatient: response.data,
    });
  } catch (error) {
    if (error.response) {
      if (error.response.status === 409) {
        // Patient existe déjà au siège
        console.log("[ESB-LOCAL] Patient existe déjà au siège");
        return res.json({
          success: true,
          message: "Patient existe déjà au siège",
          alreadyExists: true,
        });
      }
      console.error("[ESB-LOCAL] Erreur création siège:", error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    console.error("[ESB-LOCAL] Erreur sync vers siège:", error.message);
    return res.status(500).json({ error: "Erreur synchronisation vers siège" });
  }
});

// ============================================
// ENDPOINT: RÉCUPÉRER CONSULTATIONS
// ============================================
app.get("/api/consultation/patient/:patientId", async (req, res) => {
  const { patientId } = req.params;

  try {
    console.log(
      `[ESB-LOCAL] Récupération consultations pour patient ${patientId}`
    );
    const response = await axios.get(
      `${CARDIO_SERVICE_URL}/api/consultation/patient/${patientId}`
    );
    return res.json(response.data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: "Consultations non trouvées" });
    }
    console.error(
      "[ESB-LOCAL] Erreur récupération consultations:",
      error.message
    );
    return res.status(500).json({ error: "Erreur récupération consultations" });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get("/actuator/health", (req, res) => {
  res.json({ status: "UP", service: "esb-local" });
});

app.get("/health", (req, res) => {
  res.json({ status: "UP", service: "esb-local" });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[ESB-LOCAL] Running on port ${PORT}`);
  console.log(`[ESB-LOCAL] Cardio Service URL: ${CARDIO_SERVICE_URL}`);
  console.log(`[ESB-LOCAL] ESB Central URL: ${ESB_CENTRAL_URL}`);
});
