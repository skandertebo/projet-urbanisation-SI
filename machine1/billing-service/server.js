const express = require('express');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PATIENT_SERVICE_URL = process.env.PATIENT_SERVICE_URL || 'http://patient-core-service:8080';

app.use(express.json());

// Créer le répertoire pour les factures
const invoicesDir = path.join(__dirname, 'data', 'invoices');
if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
}

// Endpoint pour générer une facture
app.post('/api/billing/generate', async (req, res) => {
    try {
        const { patientId, consultationId, acts } = req.body;
        
        if (!patientId || !acts || !Array.isArray(acts)) {
            return res.status(400).json({ 
                error: 'patientId et acts (array) sont requis' 
            });
        }
        
        // Récupérer les informations du patient
        let patient;
        try {
            const response = await axios.get(`${PATIENT_SERVICE_URL}/api/patients/${patientId}`);
            patient = response.data;
        } catch (error) {
            return res.status(404).json({ 
                error: 'Patient non trouvé' 
            });
        }
        
        // Générer la facture
        const invoiceId = uuidv4();
        const invoiceNumber = `INV-${Date.now()}`;
        const invoiceDate = new Date();
        
        // Calculer le total
        const total = acts.reduce((sum, act) => sum + (act.price || 0), 0);
        
        // Créer le PDF
        const invoicePath = path.join(invoicesDir, `${invoiceNumber}.pdf`);
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(invoicePath);
        doc.pipe(stream);
        
        // En-tête de la facture
        doc.fontSize(20).text('NovaCare Medical Group', 50, 50);
        doc.fontSize(14).text('Facture Médicale', 50, 80);
        doc.fontSize(10).text(`Numéro: ${invoiceNumber}`, 50, 110);
        doc.text(`Date: ${invoiceDate.toLocaleDateString('fr-FR')}`, 50, 125);
        
        // Informations patient
        doc.fontSize(12).text('Patient:', 50, 160);
        doc.fontSize(10)
           .text(`Nom: ${patient.firstName} ${patient.lastName}`, 50, 180)
           .text(`CIN: ${patient.cin}`, 50, 195)
           .text(`Email: ${patient.email || 'N/A'}`, 50, 210);
        
        // Détails des actes
        doc.fontSize(12).text('Détails des actes:', 50, 250);
        let y = 270;
        acts.forEach((act, index) => {
            doc.fontSize(10)
               .text(`${index + 1}. ${act.description || act.code}`, 50, y)
               .text(`   Prix: ${act.price || 0} TND`, 50, y + 15);
            y += 35;
        });
        
        // Total
        doc.fontSize(14).text(`Total: ${total.toFixed(2)} TND`, 50, y + 20);
        
        doc.end();
        
        // Attendre que le PDF soit créé
        stream.on('finish', () => {
            const invoiceData = {
                invoiceId,
                invoiceNumber,
                invoiceDate: invoiceDate.toISOString(),
                patientId,
                patientName: `${patient.firstName} ${patient.lastName}`,
                consultationId,
                acts,
                total,
                pdfPath: invoicePath
            };
            
            // Sauvegarder les métadonnées
            const metadataPath = path.join(invoicesDir, `${invoiceNumber}.json`);
            fs.writeFileSync(metadataPath, JSON.stringify(invoiceData, null, 2));
            
            res.status(201).json({
                success: true,
                invoice: invoiceData,
                message: 'Facture générée avec succès'
            });
        });
        
    } catch (error) {
        console.error('Erreur lors de la génération de la facture:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la génération de la facture',
            details: error.message 
        });
    }
});

// Endpoint pour récupérer une facture
app.get('/api/billing/invoice/:invoiceNumber', (req, res) => {
    const { invoiceNumber } = req.params;
    const metadataPath = path.join(invoicesDir, `${invoiceNumber}.json`);
    const pdfPath = path.join(invoicesDir, `${invoiceNumber}.pdf`);
    
    if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        res.json(metadata);
    } else {
        res.status(404).json({ error: 'Facture non trouvée' });
    }
});

// Endpoint pour télécharger le PDF
app.get('/api/billing/invoice/:invoiceNumber/pdf', (req, res) => {
    const { invoiceNumber } = req.params;
    const pdfPath = path.join(invoicesDir, `${invoiceNumber}.pdf`);
    
    if (fs.existsSync(pdfPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
        fs.createReadStream(pdfPath).pipe(res);
    } else {
        res.status(404).json({ error: 'PDF non trouvé' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'billing-service' });
});

app.listen(PORT, () => {
    console.log(`Billing Service démarré sur le port ${PORT}`);
    console.log(`Patient Service URL: ${PATIENT_SERVICE_URL}`);
});


