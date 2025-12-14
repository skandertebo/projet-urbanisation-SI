import json
import os
from datetime import datetime

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuration
DATA_DIR = '/app/data'
PATIENTS_FILE = os.path.join(DATA_DIR, 'local_patients.json')
CONSULTATIONS_FILE = os.path.join(DATA_DIR, 'consultations.json')
ESB_LOCAL_URL = os.environ.get('ESB_LOCAL_URL', 'http://esb-local:8082')

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

def create_patient_locally(patient_data):
    """Crée un patient dans la base locale"""
    patients = load_patients()
    patient_id = str(patient_data.get('id', len(patients) + 1))
    
    patient = {
        'id': patient_id,
        'cin': patient_data.get('cin'),
        'firstName': patient_data.get('firstName'),
        'lastName': patient_data.get('lastName'),
        'dateOfBirth': patient_data.get('dateOfBirth'),
        'email': patient_data.get('email'),
        'phone': patient_data.get('phone'),
        'address': patient_data.get('address'),
        'allergies': patient_data.get('allergies', []),
        'medicalHistory': patient_data.get('medicalHistory', []),
        'createdAt': datetime.now().isoformat()
    }
    
    patients[patient_id] = patient
    save_patients(patients)
    return patient

# ============================================
# ENDPOINT PRINCIPAL : CHECK-IN PATIENT
# ============================================
@app.route('/api/checkin', methods=['POST'])
def checkin_patient():
    """
    Endpoint de check-in patient - Point d'entrée métier principal
    
    Flux:
    1. Appelle ESB-local pour rechercher le patient (local puis siège)
    2. Si trouvé → retourne le patient pour check-in
    3. Si non trouvé (404) → crée localement puis synchronise vers siège
    """
    data = request.json
    cin = data.get('cin')
    
    if not cin:
        return jsonify({'error': 'CIN est requis'}), 400
    
    print(f"[CHECKIN] Début check-in pour CIN: {cin}")
    
    # Étape 1: Rechercher le patient via ESB-local
    try:
        print(f"[CHECKIN] Appel ESB-local pour recherche patient...")
        response = requests.get(f"{ESB_LOCAL_URL}/api/patient/search", params={'cin': cin}, timeout=10)
        
        if response.status_code == 200:
            # Patient trouvé (soit local, soit synchronisé depuis siège)
            patient = response.json()
            print(f"[CHECKIN] Patient trouvé: {patient.get('firstName')} {patient.get('lastName')}")
            return jsonify({
                'status': 'checked_in',
                'message': 'Patient trouvé et prêt pour consultation',
                'patient': patient,
                'checkinTime': datetime.now().isoformat()
            }), 200
            
        elif response.status_code == 404:
            # Patient non trouvé nulle part → création nécessaire
            print(f"[CHECKIN] Patient non trouvé, création nécessaire...")
            
            # Vérifier qu'on a les données nécessaires pour créer le patient
            required_fields = ['firstName', 'lastName', 'dateOfBirth']
            missing_fields = [f for f in required_fields if not data.get(f)]
            
            if missing_fields:
                return jsonify({
                    'error': 'Patient non trouvé. Pour créer un nouveau dossier, fournir: ' + ', '.join(missing_fields),
                    'requiresCreation': True,
                    'missingFields': missing_fields
                }), 404
            
            # Étape 2: Créer le patient localement
            print(f"[CHECKIN] Création du patient localement...")
            new_patient = create_patient_locally(data)
            
            # Étape 3: Synchroniser vers le siège via ESB-local
            print(f"[CHECKIN] Synchronisation vers le siège...")
            try:
                sync_response = requests.post(
                    f"{ESB_LOCAL_URL}/api/patient/sync-to-central",
                    json=new_patient,
                    timeout=10
                )
                if sync_response.status_code in [200, 201]:
                    print(f"[CHECKIN] Patient synchronisé avec le siège")
                    # Mettre à jour avec l'ID du siège si disponible
                    sync_data = sync_response.json()
                    if sync_data.get('centralId'):
                        new_patient['centralId'] = sync_data.get('centralId')
                        patients = load_patients()
                        patients[new_patient['id']] = new_patient
                        save_patients(patients)
                else:
                    print(f"[CHECKIN] Attention: Sync vers siège échouée (HTTP {sync_response.status_code})")
            except Exception as sync_error:
                print(f"[CHECKIN] Attention: Sync vers siège échouée: {sync_error}")
                # On continue quand même - le patient est créé localement
            
            return jsonify({
                'status': 'checked_in',
                'message': 'Nouveau patient créé et synchronisé',
                'patient': new_patient,
                'isNewPatient': True,
                'checkinTime': datetime.now().isoformat()
            }), 201
        else:
            return jsonify({'error': f'Erreur ESB-local: {response.status_code}'}), 500
            
    except requests.exceptions.RequestException as e:
        print(f"[CHECKIN] Erreur communication ESB-local: {e}")
        return jsonify({'error': 'Service ESB non disponible'}), 503

# ============================================
# ENDPOINTS DE DONNÉES LOCALES
# ============================================

@app.route('/api/local_patient/<patient_id>', methods=['GET'])
def get_local_patient(patient_id):
    """Récupère un patient local par ID"""
    patients = load_patients()
    patient = patients.get(str(patient_id))
    
    if patient:
        return jsonify(patient), 200
    else:
        return jsonify({'error': 'Patient non trouvé localement'}), 404

@app.route('/api/local_patient/cin/<cin>', methods=['GET'])
def get_local_patient_by_cin(cin):
    """Récupère un patient local par CIN"""
    patients = load_patients()
    for patient_id, patient in patients.items():
        if patient.get('cin') == cin:
            return jsonify(patient), 200
    return jsonify({'error': 'Patient non trouvé localement'}), 404

@app.route('/api/local_patient', methods=['POST'])
def create_local_patient():
    """Crée/synchronise un patient dans la base locale (appelé par ESB)"""
    data = request.json
    patient = create_patient_locally(data)
    return jsonify(patient), 201

# ============================================
# ENDPOINTS CONSULTATIONS
# ============================================

@app.route('/api/consultation', methods=['POST'])
def create_consultation():
    """Crée une consultation cardiaque"""
    data = request.json
    consultations = load_consultations()
    
    consultation = {
        'id': len(consultations) + 1,
        'patientId': data.get('patientId'),
        'patientCin': data.get('patientCin'),
        'doctorId': data.get('doctorId'),
        'doctorName': data.get('doctorName'),
        'date': datetime.now().isoformat(),
        'diagnosis': data.get('diagnosis'),
        'prescription': data.get('prescription', []),
        'notes': data.get('notes'),
        'acts': data.get('acts', []),
        'status': 'completed'
    }
    
    consultations.append(consultation)
    save_consultations(consultations)
    
    return jsonify(consultation), 201

@app.route('/api/consultation/patient/<patient_id>', methods=['GET'])
def get_patient_consultations(patient_id):
    """Récupère les consultations d'un patient"""
    consultations = load_consultations()
    patient_consultations = [c for c in consultations if str(c.get('patientId')) == str(patient_id)]
    return jsonify(patient_consultations), 200

# ============================================
# HEALTH CHECK
# ============================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'service': 'cardio-consultation-service'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
