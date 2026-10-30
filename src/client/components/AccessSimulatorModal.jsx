// ===================================================================
// Modal de Simulación de Lecturas RFID — Corporación Universitaria Lasallista
// Permite probar escaneos de acceso desde cualquier sección del ecosistema
// ===================================================================
import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Modal } from './ui/Modal';
import {
  CreditCard,
  DoorClosed,
  CheckCircle2,
  XCircle,
  Radio,
  User,
  GraduationCap,
  Sparkles
} from 'lucide-react';

export const AccessSimulatorModal = ({ isOpen, onClose, defaultDoorId = null }) => {
  const [doors, setDoors] = useState([]);
  const [selectedDoorId, setSelectedDoorId] = useState(defaultDoorId ? String(defaultDoorId) : '1');
  const [customUid, setCustomUid] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('A1B2C3D4');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultDoorId) {
      setSelectedDoorId(String(defaultDoorId));
    }
  }, [defaultDoorId]);

  useEffect(() => {
    if (isOpen) {
      apiClient('/doors').then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setDoors(res.data);
          if (!defaultDoorId && !selectedDoorId) {
            setSelectedDoorId(String(res.data[0].id));
          }
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  const presets = [
    {
      uid: 'A1B2C3D4',
      name: 'Valentina Ochoa Calle',
      program: 'Medicina Veterinaria',
      role: 'Estudiante',
      type: 'success',
      desc: 'Acceso Autorizado · Carnet Válido'
    },
    {
      uid: 'E4A23B10',
      name: 'Mateo Gómez Restrepo',
      program: 'Ingeniería de Sistemas',
      role: 'Estudiante',
      type: 'success',
      desc: 'Acceso Autorizado · Carnet Válido'
    },
    {
      uid: '12345678',
      name: 'Camila Londoño Pérez',
      program: 'Ingeniería de Alimentos',
      role: 'Estudiante',
      type: 'success',
      desc: 'Acceso Autorizado · Carnet Válido'
    },
    {
      uid: '9F8E7D6C',
      name: 'Sebastián Arboleda Ríos',
      program: 'Zootecnia',
      role: 'Estudiante',
      type: 'success',
      desc: 'Acceso Autorizado · Carnet Válido'
    },
    {
      uid: '99887766',
      name: 'Desconocido / Tarjeta No Enrolada',
      program: 'Sin Registro Institucional',
      role: 'Visitante',
      type: 'denied',
      desc: 'Acceso Denegado · UID Desconocido'
    }
  ];

  const handleSimulate = async (uidToUse = null) => {
    const finalUid = (uidToUse || customUid || selectedPreset || 'A1B2C3D4').trim().toUpperCase();
    const finalDoorId = parseInt(selectedDoorId || '1', 10);

    try {
      setIsSubmitting(true);
      await apiClient('/access/validate', {
        method: 'POST',
        body: {
          rfid_uid: finalUid,
          door_id: finalDoorId,
          access_method: 'simulado'
        }
      });
      // Cerrar este modal de configuración para que el Pop-up Global brille en toda la pantalla
      onClose();
    } catch (err) {
      console.error('Error al simular escaneo:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Simulador de Lectura RFID en Tiempo Real">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Seleccione una puerta y un carnet de estudiante (o ingrese un UID personalizado) para probar la validación y ver el <b>Pop-up de pantalla completa</b>.
        </p>

        {/* 1. Selector de Puerta */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
            <DoorClosed size={15} style={{ color: 'var(--accent)' }} />
            <span>Punto de Acceso / Puerta</span>
          </label>
          <select
            className="form-select"
            value={selectedDoorId}
            onChange={(e) => setSelectedDoorId(e.target.value)}
            style={{ fontSize: '13px' }}
          >
            {doors.map(d => (
              <option key={d.id} value={d.id}>
                Puerta #{d.id}: {d.name} {d.room_name ? `(${d.room_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Presets de Estudiantes y Tarjetas */}
        <div>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', marginBottom: '8px' }}>
            <Sparkles size={15} style={{ color: 'var(--accent)' }} />
            <span>Escenarios Rápidos de Prueba (1 Estudiante = 1 UID)</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {presets.map(p => (
              <div
                key={p.uid}
                onClick={() => {
                  setSelectedPreset(p.uid);
                  setCustomUid('');
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `1.5px solid ${selectedPreset === p.uid && !customUid ? 'var(--accent)' : 'var(--border)'}`,
                  backgroundColor: selectedPreset === p.uid && !customUid ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: p.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: p.type === 'success' ? '#10b981' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {p.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span>{p.program}</span>
                      <span>·</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>UID: {p.uid}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSimulate(p.uid);
                  }}
                  className={`btn btn-sm ${p.type === 'success' ? 'btn-primary' : 'btn-danger'}`}
                  style={{ fontSize: '11.5px', padding: '4px 10px' }}
                >
                  <Radio size={12} />
                  <span>Escanear</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 3. UID Personalizado */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
            <CreditCard size={15} style={{ color: 'var(--accent)' }} />
            <span>O ingresar UID Personalizado</span>
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: A1B2C3D4 o cualquier código hex"
              value={customUid}
              onChange={(e) => setCustomUid(e.target.value.toUpperCase())}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
            />
            <button
              type="button"
              disabled={isSubmitting || !customUid.trim()}
              onClick={() => handleSimulate(customUid)}
              className="btn btn-secondary"
              style={{ whiteSpace: 'nowrap' }}
            >
              Probar UID
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
