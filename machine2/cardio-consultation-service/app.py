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
    """Crée un patient dans la base locale (format snake_case local)"""
    patients = load_patients()
    patient_id = str(patient_data.get('id', len(patients) + 1))
    now = datetime.now().isoformat()

    # Local clinic uses snake_case format
    patient = {
        'id': patient_id,
        'cin': patient_data.get('cin'),
        'first_name': patient_data.get('first_name'),
        'last_name': patient_data.get('last_name'),
        'date_of_birth': patient_data.get('date_of_birth'),
        'contact_email': patient_data.get('contact_email'),
        'contact_phone': patient_data.get('contact_phone'),
        'home_address': patient_data.get('home_address'),
        'known_allergies': patient_data.get('known_allergies', []),
        'medical_history': patient_data.get('medical_history', []),
        'blood_type': patient_data.get('blood_type'),
        'emergency_contact': patient_data.get('emergency_contact'),
        'created_at': now,
        'updated_at': now,
        'synced_at': None
    }

    patients[patient_id] = patient
    save_patients(patients)
    return patient

def update_patient_locally(patient_id, patient_data):
    """Met à jour un patient dans la base locale (format snake_case)"""
    patients = load_patients()
    if patient_id not in patients:
        return None

    patient = patients[patient_id]

    # Mettre à jour les champs modifiables (snake_case format)
    for field in ['first_name', 'last_name', 'date_of_birth', 'contact_email', 'contact_phone', 'home_address', 'known_allergies', 'medical_history', 'blood_type', 'emergency_contact']:
        if patient_data.get(field) is not None:
            patient[field] = patient_data.get(field)

    patient['updated_at'] = datetime.now().isoformat()

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

    Note: Local clinic uses snake_case, ESB handles transformation
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
            # ESB returns camelCase format, we store in snake_case
            patient = response.json()
            print(f"[CHECKIN] Patient trouvé: {patient.get('firstName')} {patient.get('lastName')}")
            return jsonify({
                'status': 'checked_in',
                'message': 'Patient trouvé et prêt pour consultation',
                'patient': patient,
                'checkinTime': datetime.now().isoformat(),
                '_format_note': 'Response in API format (camelCase), local storage uses snake_case'
            }), 200

        elif response.status_code == 404:
            # Patient non trouvé nulle part → création nécessaire
            print(f"[CHECKIN] Patient non trouvé, création nécessaire...")

            # Accept both camelCase (from API) and snake_case (from local forms)
            first_name = data.get('first_name') or data.get('firstName')
            last_name = data.get('last_name') or data.get('lastName')
            date_of_birth = data.get('date_of_birth') or data.get('dateOfBirth')

            # Vérifier qu'on a les données nécessaires pour créer le patient
            missing_fields = []
            if not first_name:
                missing_fields.append('first_name/firstName')
            if not last_name:
                missing_fields.append('last_name/lastName')
            if not date_of_birth:
                missing_fields.append('date_of_birth/dateOfBirth')

            if missing_fields:
                return jsonify({
                    'error': 'Patient non trouvé. Pour créer un nouveau dossier, fournir: ' + ', '.join(missing_fields),
                    'requiresCreation': True,
                    'missingFields': missing_fields,
                    '_format_hint': {
                        'local_format': 'snake_case (first_name, last_name, date_of_birth)',
                        'api_format': 'camelCase (firstName, lastName, dateOfBirth)',
                        'both_accepted': True
                    }
                }), 404

            # Étape 2: Créer le patient localement (snake_case format)
            print(f"[CHECKIN] Création du patient localement (format snake_case)...")
            patient_data = {
                'cin': cin,
                'first_name': first_name,
                'last_name': last_name,
                'date_of_birth': date_of_birth,
                'contact_email': data.get('contact_email') or data.get('email'),
                'contact_phone': data.get('contact_phone') or data.get('phone'),
                'home_address': data.get('home_address') or data.get('address'),
                'known_allergies': data.get('known_allergies') or data.get('allergies', []),
                'medical_history': data.get('medical_history') or data.get('medicalHistory', []),
                'blood_type': data.get('blood_type') or data.get('bloodType'),
                'emergency_contact': data.get('emergency_contact') or data.get('emergencyContact')
            }
            new_patient = create_patient_locally(patient_data)

            # Étape 3: Synchroniser vers le siège via ESB-local
            # ESB-local will transform snake_case to camelCase
            print(f"[CHECKIN] Synchronisation vers le siège via ESB (transformation snake_case → camelCase)...")
            try:
                sync_response = requests.post(
                    f"{ESB_LOCAL_URL}/api/patient/sync-to-central",
                    json=new_patient,
                    timeout=10
                )
                if sync_response.status_code in [200, 201]:
                    print(f"[CHECKIN] Patient synchronisé avec le siège (format transformé)")
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

            # Return in API format (camelCase) for consistency
            return jsonify({
                'status': 'checked_in',
                'message': 'Nouveau patient créé et synchronisé',
                'patient': {
                    'id': new_patient['id'],
                    'cin': new_patient['cin'],
                    'firstName': new_patient['first_name'],
                    'lastName': new_patient['last_name'],
                    'dateOfBirth': new_patient['date_of_birth'],
                    'email': new_patient['contact_email'],
                    'phone': new_patient['contact_phone'],
                    'address': new_patient['home_address'],
                    'allergies': new_patient['known_allergies'],
                    'medicalHistory': new_patient['medical_history']
                },
                'isNewPatient': True,
                'checkinTime': datetime.now().isoformat(),
                '_format_note': 'Stored in snake_case, returned in camelCase (API format)'
            }), 201
        else:
            return jsonify({'error': f'Erreur ESB-local: {response.status_code}'}), 500

    except requests.exceptions.RequestException as e:
        print(f"[CHECKIN] Erreur communication ESB-local: {e}")
        return jsonify({'error': 'Service ESB non disponible'}), 503

# ============================================
# ENDPOINTS DE DONNÉES LOCALES
# ============================================

@app.route('/api/local_patients', methods=['GET'])
def get_all_local_patients():
    """Récupère tous les patients locaux"""
    patients = load_patients()
    return jsonify(list(patients.values())), 200

@app.route('/api/local_patient/<patient_id>', methods=['GET'])
def get_local_patient(patient_id):
    """Récupère un patient local par ID"""
    patients = load_patients()
    patient = patients.get(str(patient_id))

    if patient:
        return jsonify(patient), 200
    else:
        return jsonify({'error': 'Patient non trouvé localement'}), 404

@app.route('/api/local_patient/<patient_id>', methods=['PUT'])
def update_local_patient(patient_id):
    """Met à jour un patient local"""
    data = request.json
    patient = update_patient_locally(str(patient_id), data)

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
