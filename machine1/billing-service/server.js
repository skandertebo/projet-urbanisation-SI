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
// Uses internal format: patient_identifier, consultation_ref, billing_items
app.post('/api/billing/generate', async (req, res) => {
    try {
        // Internal billing format uses different field names
        const { patient_identifier, consultation_ref, billing_items } = req.body;

        if (!patient_identifier || !billing_items || !Array.isArray(billing_items)) {
            return res.status(400).json({
                error: 'patient_identifier et billing_items (array) sont requis',
                expected_format: {
                    patient_identifier: 'ID du patient',
                    consultation_ref: 'Référence de la consultation (optionnel)',
                    billing_items: [{
                        item_code: 'CODE_ACTE',
                        item_description: 'Description de l\'acte',
                        unit_price: 0.00,
                        quantity: 1
                    }]
                }
            });
        }

        // Récupérer les informations du patient
        let patient;
        try {
            const response = await axios.get(`${PATIENT_SERVICE_URL}/api/patients/${patient_identifier}`);
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

        // Calculer le total from billing_items
        const total = billing_items.reduce((sum, item) => {
            const quantity = item.quantity || 1;
            return sum + ((item.unit_price || 0) * quantity);
        }, 0);

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

        // Informations patient (transformed from ESB)
        doc.fontSize(12).text('Patient:', 50, 160);
        doc.fontSize(10)
           .text(`Nom: ${patient.firstName} ${patient.lastName}`, 50, 180)
           .text(`CIN: ${patient.cin}`, 50, 195)
           .text(`Email: ${patient.email || 'N/A'}`, 50, 210);

        // Détails des actes (from billing_items format)
        doc.fontSize(12).text('Détails des actes:', 50, 250);
        let y = 270;
        billing_items.forEach((item, index) => {
            const quantity = item.quantity || 1;
            const lineTotal = (item.unit_price || 0) * quantity;
            doc.fontSize(10)
               .text(`${index + 1}. ${item.item_description || item.item_code}`, 50, y)
               .text(`   Quantité: ${quantity} x ${item.unit_price || 0} TND = ${lineTotal.toFixed(2)} TND`, 50, y + 15);
            y += 35;
        });

        // Total
        doc.fontSize(14).text(`Total: ${total.toFixed(2)} TND`, 50, y + 20);

        doc.end();

        // Attendre que le PDF soit créé
        stream.on('finish', () => {
            // Return in billing service internal format
            const invoiceData = {
                invoice_id: invoiceId,
                invoice_number: invoiceNumber,
                invoice_date: invoiceDate.toISOString(),
                patient_identifier,
                patient_full_name: `${patient.firstName} ${patient.lastName}`,
                consultation_ref,
                billing_items,
                total_amount: total,
                currency: 'TND',
                pdf_path: invoicePath,
                status: 'generated'
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


