from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Répertoire pour les données
DATA_DIR = '/app/data'
PATIENTS_FILE = os.path.join(DATA_DIR, 'local_patients.json')
CONSULTATIONS_FILE = os.path.join(DATA_DIR, 'consultations.json')

# Initialiser les fichiers de données
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

def load_patients():
    if os.path.exists(PATIENTS_FILE):
        with open(PATIENTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_patients(patients):
    with open(PATIENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(patients, f, indent=2, ensure_ascii=False)

def load_consultations():
    if os.path.exists(CONSULTATIONS_FILE):
        with open(CONSULTATIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_consultations(consultations):
    with open(CONSULTATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(consultations, f, indent=2, ensure_ascii=False)

# Endpoint pour rechercher un patient local
@app.route('/api/local_patient/<patient_id>', methods=['GET'])
def get_local_patient(patient_id):
    patients = load_patients()
    patient = patients.get(str(patient_id))
    
    if patient:
        return jsonify(patient), 200
    else:
        return jsonify({'error': 'Patient non trouvé localement'}), 404

# Endpoint pour rechercher par CIN
@app.route('/api/local_patient/cin/<cin>', methods=['GET'])
def get_local_patient_by_cin(cin):
    patients = load_patients()
    for patient_id, patient in patients.items():
        if patient.get('cin') == cin:
            return jsonify(patient), 200
    return jsonify({'error': 'Patient non trouvé localement'}), 404

# Endpoint pour créer/synchroniser un patient local
@app.route('/api/local_patient', methods=['POST'])
def create_local_patient():
    data = request.json
    patients = load_patients()
    
    # Utiliser l'ID du patient ou générer un nouvel ID
    patient_id = str(data.get('id', len(patients) + 1))
    
    patient = {
        'id': patient_id,
        'cin': data.get('cin'),
        'firstName': data.get('firstName'),
        'lastName': data.get('lastName'),
        'dateOfBirth': data.get('dateOfBirth'),
        'email': data.get('email'),
        'phone': data.get('phone'),
        'address': data.get('address'),
        'allergies': data.get('allergies', []),
        'medicalHistory': data.get('medicalHistory', []),
        'syncedAt': datetime.now().isoformat()
    }
    
    patients[patient_id] = patient
    save_patients(patients)
    
    return jsonify(patient), 201

# Endpoint pour créer une consultation cardiaque
@app.route('/api/consultation', methods=['POST'])
def create_consultation():
    data = request.json
    consultations = load_consultations()
    
    consultation = {
        'id': len(consultations) + 1,
        'patientId': data.get('patientId'),
        'doctorId': data.get('doctorId'),
        'date': datetime.now().isoformat(),
        'diagnosis': data.get('diagnosis'),
        'prescription': data.get('prescription', []),
        'acts': data.get('acts', []),  # Codes actes pour facturation
        'status': 'completed'
    }
    
    consultations.append(consultation)
    save_consultations(consultations)
    
    return jsonify(consultation), 201

# Endpoint pour récupérer les consultations d'un patient
@app.route('/api/consultation/patient/<patient_id>', methods=['GET'])
def get_patient_consultations(patient_id):
    consultations = load_consultations()
    patient_consultations = [c for c in consultations if str(c.get('patientId')) == str(patient_id)]
    return jsonify(patient_consultations), 200

# Health check
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'service': 'cardio-consultation-service'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


