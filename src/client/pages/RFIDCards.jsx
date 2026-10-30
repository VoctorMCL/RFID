// ===================================================================
// Gestión y Asignación de Tarjetas RFID — Corporación Universitaria Lasallista
// Rework Integral: Asignación Obligatoria por Sensor + Pases de Seguridad
// ===================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { Modal } from '../components/ui/Modal';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Radio,
  Trash2,
  Power,
  Clock,
  UserCheck,
  AlertTriangle,
  Building,
  RotateCcw,
  Check,
  FileText,
  UserPlus,
  History,
  Layers,
  ArrowRight
} from 'lucide-react';

export const RFIDCards = () => {
  const { isAdmin, canManageSecurity, user } = useAuth();

  // Estados de navegación y datos
  const [activeTab, setActiveTab] = useState('active_passes'); // 'active_passes' | 'pass_history' | 'inventory'
  const [cards, setCards] = useState([]);
  const [passes, setPasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modales
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [returningPass, setReturningPass] = useState(null);

  // Estado del Formulario de Pase con Sensor
  const [scannedCardUid, setScannedCardUid] = useState('');
  const [sensorStatus, setSensorStatus] = useState('waiting'); // 'waiting' | 'detected'
  const [personType, setPersonType] = useState('student');
  const [fullName, setFullName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [phone, setPhone] = useState('');
  const [destination, setDestination] = useState('Bloque A - Aulas');
  const [reason, setReason] = useState('');
  const [missingCardReason, setMissingCardReason] = useState('Olvido de carnet en casa');
  const [customMissingReason, setCustomMissingReason] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario de enrolamiento de inventario (Admin)
  const [invFormData, setInvFormData] = useState({
    uid: '',
    user_id: '',
    card_type: 'standard',
    label: ''
  });

  const lastSeenScanIdRef = useRef(null);
  const wedgeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Cargar datos desde la API
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cardsRes, passesRes, usersRes] = await Promise.all([
        apiClient('/rfid-cards'),
        apiClient('/visitor-passes'),
        apiClient('/users')
      ]);

      if (cardsRes.success) setCards(cardsRes.data || []);
      if (passesRes.success) setPasses(passesRes.data || []);
      if (usersRes.success) setUsers(usersRes.data || []);
    } catch (err) {
      console.error('Error cargando información de tarjetas RFID:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Manejador de escaneo físico para el formulario
  const handlePhysicalScan = useCallback((uid) => {
    if (!uid) return;
    const clean = uid.trim().replace(/[\s:\-]/g, '').toUpperCase();
    if (clean.length < 4) return;

    setScannedCardUid(clean);
    setSensorStatus('detected');
    setFormError('');
  }, []);

  // 1. Escuchar eventos en vivo desde WebSocket
  const handleWsEvent = useCallback((event) => {
    if (event.type === 'visitor_pass_created' || event.type === 'visitor_pass_returned') {
      loadData();
    }

    // Si el modal de nuevo pase está abierto, capturar la tarjeta que pase por el sensor
    if (isPassModalOpen && event.type === 'access_attempt' && event.data?.uid) {
      handlePhysicalScan(event.data.uid);
    }
  }, [isPassModalOpen, handlePhysicalScan, loadData]);

  useWebSocket(handleWsEvent);

  // 2. Polling de respaldo para el sensor físico cuando el modal está abierto
  useEffect(() => {
    if (!isPassModalOpen) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiClient('/access/latest');
        if (res.success && res.data?.uid) {
          const scan = res.data;
          const scanTime = new Date(scan.timestamp).getTime();
          const isFresh = (Date.now() - scanTime) < 4000;

          if (isFresh && scan.id !== lastSeenScanIdRef.current) {
            lastSeenScanIdRef.current = scan.id;
            handlePhysicalScan(scan.uid);
          }
        }
      } catch (e) {}
    }, 1200);

    return () => clearInterval(interval);
  }, [isPassModalOpen, handlePhysicalScan]);

  // 3. Soporte para lector USB de teclado en el modal
  useEffect(() => {
    if (!isPassModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const now = Date.now();
      if (now - lastKeyTimeRef.current > 150) {
        wedgeBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const potential = wedgeBufferRef.current.trim();
        wedgeBufferRef.current = '';
        if (potential.length >= 4) {
          handlePhysicalScan(potential);
        }
      } else if (e.key.length === 1) {
        wedgeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPassModalOpen, handlePhysicalScan]);

  // Abrir modal de asignación y resetear formulario
  const handleOpenPassModal = () => {
    setScannedCardUid('');
    setSensorStatus('waiting');
    setPersonType('student');
    setFullName('');
    setDocumentId('');
    setPhone('');
    setDestination('Bloque A - Aulas');
    setReason('');
    setMissingCardReason('Olvido de carnet en casa');
    setCustomMissingReason('');
    setNotes('');
    setFormError('');
    setIsPassModalOpen(true);
  };

  // Enviar formulario de nuevo pase
  const handleSubmitPass = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!scannedCardUid) {
      setFormError('⚠️ Debe acercar obligatoriamente una tarjeta física al sensor para vincularla.');
      return;
    }

    if (!fullName.trim() || !documentId.trim() || !reason.trim()) {
      setFormError('Por favor complete todos los campos obligatorios del registro.');
      return;
    }

    const finalMissingReason = personType === 'student'
      ? (missingCardReason === 'Otro' ? customMissingReason.trim() : missingCardReason)
      : null;

    if (personType === 'student' && !finalMissingReason) {
      setFormError('Debe especificar la causa por la que el estudiante no tiene su carnet.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient('/visitor-passes', {
        method: 'POST',
        body: {
          card_uid: scannedCardUid,
          person_type: personType,
          full_name: fullName.trim(),
          document_id: documentId.trim(),
          phone: phone.trim() || null,
          destination,
          reason: reason.trim(),
          missing_card_reason: finalMissingReason,
          notes: notes.trim() || null
        }
      });

      if (res.success) {
        setIsPassModalOpen(false);
        loadData();
      } else {
        setFormError(res.error || 'Error registrando el pase.');
      }
    } catch (err) {
      setFormError(err.message || 'Error comunicando con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registrar devolución de pase
  const handleConfirmReturn = async () => {
    if (!returningPass) return;
    try {
      const res = await apiClient(`/visitor-passes/${returningPass.id}/return`, {
        method: 'PUT'
      });
      if (res.success) {
        setReturningPass(null);
        loadData();
      }
    } catch (err) {
      alert('Error registrando devolución: ' + err.message);
    }
  };

  // Acciones sobre tarjetas de inventario
  const handleToggleCardActive = async (card) => {
    try {
      const res = await apiClient(`/rfid-cards/${card.id}`, {
        method: 'PUT',
        body: { is_active: !card.is_active }
      });
      if (res.success) {
        setCards(prev => prev.map(c => c.id === card.id ? { ...c, is_active: !card.is_active } : c));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCard = async (id) => {
    if (!window.confirm('¿Desea eliminar esta tarjeta RFID del inventario permanente?')) return;
    try {
      const res = await apiClient(`/rfid-cards/${id}`, { method: 'DELETE' });
      if (res.success) {
        setCards(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEnrollInventoryCard = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient('/rfid-cards/enroll', {
        method: 'POST',
        body: invFormData
      });
      if (res.success) {
        loadData();
        setIsInventoryModalOpen(false);
        setInvFormData({ uid: '', user_id: '', card_type: 'standard', label: '' });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Cálculos de tiempo transcurrido
  const getElapsedTime = (entryTimeStr) => {
    if (!entryTimeStr) return '—';
    const diffMs = Date.now() - new Date(entryTimeStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Hace instantes';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m transcurridos`;
  };

  const activePasses = passes.filter(p => p.status === 'active');
  const pastPasses = passes.filter(p => p.status === 'returned');

  // Filtrado de búsquedas
  const filteredActivePasses = activePasses.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.document_id.toLowerCase().includes(search.toLowerCase()) ||
    p.card_uid.toLowerCase().includes(search.toLowerCase()) ||
    (p.reason && p.reason.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPastPasses = pastPasses.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.document_id.toLowerCase().includes(search.toLowerCase()) ||
    p.card_uid.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCards = cards.filter(c =>
    c.uid.toLowerCase().includes(search.toLowerCase()) ||
    (c.user_name && c.user_name.toLowerCase().includes(search.toLowerCase())) ||
    (c.label && c.label.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Encabezado Principal */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Control de Tarjetas RFID y Pases de Seguridad</h1>
          <p className="page-subtitle">
            Asignación vinculante por sensor para visitantes, estudiantes y préstamos temporales en portería
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Botón Principal: Registrar Pase con Sensor (Visible para Celador y Admin) */}
          <button className="btn btn-primary" onClick={handleOpenPassModal} style={{ gap: '8px', padding: '10px 18px', fontWeight: 600 }}>
            <Radio size={17} />
            <span>Vincular Tarjeta con Sensor</span>
          </button>

          {/* Enrolamiento permanente (Admin) */}
          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => setIsInventoryModalOpen(true)} title="Enrolar en inventario fijo">
              <Plus size={16} />
              <span>Tarjeta Fija</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner de Estado del Sensor de Portería */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: 'var(--accent-soft)',
            border: '1px solid var(--accent-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)'
          }}>
            <Radio size={22} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Puesto de Control y Asignación de Tarjetas
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Sensor MFRC522 listo para vincular credenciales físicas a formularios de ingreso
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            Pases activos en campus: <strong style={{ color: 'var(--accent)' }}>{activePasses.length}</strong>
          </div>
          <span className="badge badge-ok">Lector en escucha</span>
        </div>
      </div>

      {/* Selector de Pestañas (Tabs) */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '20px',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('active_passes')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: activeTab === 'active_passes' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'active_passes' ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          <UserCheck size={16} />
          <span>Pases Activos en Campus ({activePasses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pass_history')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: activeTab === 'pass_history' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'pass_history' ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          <History size={16} />
          <span>Historial de Devoluciones</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('inventory')}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 18px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: activeTab === 'inventory' ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'inventory' ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            <Layers size={16} />
            <span>Inventario General de Tarjetas ({cards.length})</span>
          </button>
        )}
      </div>

      {/* Buscador Común */}
      <div className="card" style={{ marginBottom: '20px', padding: '12px 16px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-input font-mono"
            style={{ paddingLeft: '38px' }}
            placeholder={
              activeTab === 'inventory'
                ? 'Buscar por UID Hex, nombre de titular o carnet...'
                : 'Buscar por nombre, documento de identidad, UID o motivo...'
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* PESTAÑA 1: PASES ACTIVOS EN CAMPUS */}
      {activeTab === 'active_passes' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarjeta Asignada</th>
                <th>Persona / Titular</th>
                <th>Destino y Motivo</th>
                <th>Justificación sin Carnet</th>
                <th>Hora Ingreso y Tiempo</th>
                <th>Autorizado por</th>
                <th style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivePasses.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      No hay personas con tarjetas temporales activas en el campus
                    </div>
                    <div style={{ fontSize: '12.5px' }}>
                      Haga clic en <strong>"Vincular Tarjeta con Sensor"</strong> para registrar un ingreso.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredActivePasses.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-mono" style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--accent)' }}>
                        {p.card_uid}
                      </div>
                      <span className="badge badge-ok" style={{ fontSize: '10.5px', marginTop: '2px' }}>
                        En Préstamo
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{p.full_name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Doc: {p.document_id}</div>
                      {p.phone && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Tel: {p.phone}</div>}
                      <span className="badge badge-neutral" style={{ fontSize: '10.5px', marginTop: '3px' }}>
                        {p.person_type === 'student' ? 'Estudiante' : p.person_type === 'visitor' ? 'Visitante' : p.person_type === 'professor' ? 'Docente' : 'Contratista'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Building size={13} style={{ color: 'var(--text-muted)' }} />
                        {p.destination || 'Campus General'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {p.reason}
                      </div>
                    </td>
                    <td>
                      {p.missing_card_reason ? (
                        <div style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          fontSize: '11.5px',
                          lineHeight: 1.3
                        }}>
                          {p.missing_card_reason}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>N/A (Visitante)</span>
                      )}
                    </td>
                    <td>
                      <div className="font-mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                        {new Date(p.entry_time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                        {getElapsedTime(p.entry_time)}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>
                        {p.issuer_name || 'Portería Principal'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setReturningPass(p)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          borderColor: 'var(--accent-border)',
                          color: 'var(--accent)',
                          fontWeight: 600
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Registrar Salida</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 2: HISTORIAL DE DEVOLUCIONES */}
      {activeTab === 'pass_history' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarjeta</th>
                <th>Persona</th>
                <th>Tipo</th>
                <th>Motivo y Causa</th>
                <th>Ingreso</th>
                <th>Salida</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredPastPasses.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No se registran devoluciones pasadas en el historial.
                  </td>
                </tr>
              ) : (
                filteredPastPasses.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono" style={{ fontWeight: 700 }}>{p.card_uid}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.full_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Doc: {p.document_id}</div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {p.person_type === 'student' ? 'Estudiante' : p.person_type === 'visitor' ? 'Visitante' : 'Docente'}
                      </span>
                    </td>
                    <td>
                      <div>{p.reason}</div>
                      {p.missing_card_reason && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Sin carnet por: {p.missing_card_reason}
                        </div>
                      )}
                    </td>
                    <td className="font-mono" style={{ fontSize: '11.5px' }}>
                      {new Date(p.entry_time).toLocaleString('es-CO')}
                    </td>
                    <td className="font-mono" style={{ fontSize: '11.5px' }}>
                      {p.exit_time ? new Date(p.exit_time).toLocaleString('es-CO') : '—'}
                    </td>
                    <td>
                      <span className="badge badge-ok">Devuelta</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA 3: INVENTARIO GENERAL (Solo Admin) */}
      {activeTab === 'inventory' && isAdmin && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>UID Hex</th>
                <th>Titular Asignado</th>
                <th>Rol</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Fecha Enrolamiento</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No se encontraron tarjetas en el inventario.
                  </td>
                </tr>
              ) : (
                filteredCards.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-mono" style={{ fontWeight: 700, fontSize: '13.5px' }}>{c.uid}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.label || 'Tarjeta estándar'}</div>
                    </td>
                    <td>
                      {c.user_name ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.user_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Doc: {c.user_document}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Sin titular vinculado</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{c.user_role || 'No asignado'}</span>
                    </td>
                    <td>
                      {c.card_type === 'master' ? (
                        <span className="badge badge-alert" style={{ fontSize: '11px' }}>
                          <ShieldCheck size={12} /> Ficha maestra
                        </span>
                      ) : c.card_type === 'temporary' ? (
                        <span className="badge badge-ok" style={{ fontSize: '11px' }}>Temporal / Visita</span>
                      ) : (
                        <span className="badge badge-neutral">Estándar</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-ok' : 'badge-denied'}`}>
                        {c.is_active ? 'Activa' : 'Desactivada'}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {c.enrolled_at ? new Date(c.enrolled_at).toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => handleToggleCardActive(c)}
                          className="btn btn-secondary btn-sm"
                          title={c.is_active ? 'Desactivar tarjeta' : 'Activar tarjeta'}
                        >
                          <Power size={13} style={{ color: c.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                        </button>
                        <button
                          onClick={() => handleDeleteCard(c.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--text-muted)' }}
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FORMULARIO CON VINCULACIÓN OBLIGATORIA POR SENSOR (REWORK CENTRAL) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        title="Vincular Tarjeta Física y Registrar Ingreso"
        maxWidth="640px"
      >
        <form onSubmit={handleSubmitPass}>
          {/* PASO 1: DETECCIÓN OBLIGATORIA POR SENSOR */}
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: sensorStatus === 'detected' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-tertiary)',
            border: `1.5px dashed ${sensorStatus === 'detected' ? '#10b981' : 'var(--border)'}`,
            marginBottom: '20px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: sensorStatus === 'detected' ? 'rgba(16, 185, 129, 0.2)' : 'var(--accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: sensorStatus === 'detected' ? '#10b981' : 'var(--accent)'
                }}>
                  {sensorStatus === 'detected' ? <Check size={20} /> : <Radio size={19} className="spinner" />}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Paso 1: Lectura Física en el Sensor
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {sensorStatus === 'detected'
                      ? 'Tarjeta detectada y vinculada por hardware'
                      : 'Acerque la tarjeta física al sensor RFID para desbloquear el formulario'}
                  </div>
                </div>
              </div>

              {sensorStatus === 'detected' && (
                <button
                  type="button"
                  onClick={() => {
                    setScannedCardUid('');
                    setSensorStatus('waiting');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11.5px' }}
                >
                  Cambiar Tarjeta
                </button>
              )}
            </div>

            {/* Campo UID Bloqueado / Verificado */}
            <div style={{ marginTop: '14px' }}>
              <label className="form-label" style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                UID Físico Vinculado (Lectura Automática Obligatoria)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input font-mono"
                  readOnly
                  placeholder="Esperando lectura del sensor de hardware..."
                  value={scannedCardUid ? `UID: ${scannedCardUid} — [VERIFICADO POR SENSOR]` : ''}
                  style={{
                    backgroundColor: sensorStatus === 'detected' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                    borderColor: sensorStatus === 'detected' ? '#10b981' : 'var(--border)',
                    color: sensorStatus === 'detected' ? '#10b981' : 'var(--text-dim)',
                    fontWeight: 700,
                    cursor: 'not-allowed'
                  }}
                />
              </div>
            </div>
          </div>

          {/* PASO 2: DATOS DEL VISITANTE / ESTUDIANTE */}
          <div style={{
            opacity: sensorStatus === 'detected' ? 1 : 0.45,
            pointerEvents: sensorStatus === 'detected' ? 'auto' : 'none',
            transition: 'opacity 0.3s ease'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px', color: 'var(--text-primary)' }}>
              Paso 2: Información de Seguridad y Motivo de Ingreso
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tipo de Persona *</label>
                <select
                  className="form-select"
                  value={personType}
                  onChange={e => setPersonType(e.target.value)}
                  required
                >
                  <option value="student">Estudiante Lasallista (Sin carnet)</option>
                  <option value="visitor">Visitante Externo</option>
                  <option value="professor">Docente / Invitado Académico</option>
                  <option value="contractor">Contratista / Proveedor</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Destino / Bloque o Sala *</label>
                <select
                  className="form-select"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  required
                >
                  <option value="Bloque A - Aulas">Bloque A - Aulas de Clase</option>
                  <option value="Bloque B - Sala de Idiomas / Aulas">Bloque B - Idiomas y Aulas</option>
                  <option value="Bloque C - Laboratorios y Sistemas">Bloque C - Laboratorios de Cómputo</option>
                  <option value="Bloque Administrativo - Oficinas">Bloque Administrativo / Rectoría</option>
                  <option value="Biblioteca Central">Biblioteca Central</option>
                  <option value="Otro Destino">Otro Espacio del Campus</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nombre Completo *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Juan Esteban Pérez Restrepo"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Documento de Identidad *</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="Cédula o T.I."
                  value={documentId}
                  onChange={e => setDocumentId(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Teléfono de Contacto</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. 300 123 4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Hora de Ingreso (Automática)</label>
                <div style={{
                  padding: '9px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Clock size={14} style={{ color: 'var(--accent)' }} />
                  <span>{new Date().toLocaleTimeString('es-CO')} — Registro en Vivo</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN ESPECIAL PARA ESTUDIANTES: ¿Por qué no tiene su carnet? */}
            {personType === 'student' && (
              <div style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                marginBottom: '14px'
              }}>
                <label className="form-label" style={{ color: '#ef4444', fontWeight: 700 }}>
                  🚨 Causa de Ausencia del Carnet Institucional *
                </label>
                <select
                  className="form-select"
                  value={missingCardReason}
                  onChange={e => setMissingCardReason(e.target.value)}
                  required
                >
                  <option value="Olvido de carnet en casa">Olvido de carnet físico en casa</option>
                  <option value="Pérdida o extravío (En proceso de trámite)">Pérdida o extravío (En trámite de duplicado)</option>
                  <option value="Carnet físico deteriorado / chip averiado">Carnet deteriorado / no lee en torniquete</option>
                  <option value="Estudiante de nuevo ingreso / carnet no emitido">Estudiante de nuevo ingreso (Sin carnet emitido)</option>
                  <option value="Otro">Otro motivo (especificar a continuación)</option>
                </select>

                {missingCardReason === 'Otro' && (
                  <input
                    type="text"
                    className="form-input"
                    style={{ marginTop: '8px' }}
                    placeholder="Describa brevemente la razón..."
                    value={customMissingReason}
                    onChange={e => setCustomMissingReason(e.target.value)}
                    required
                  />
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Motivo del Ingreso / Asunto a Tratar *</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Ej. Asistencia a clase de Cálculo Diferencial con Docente Carlos Duque..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Observaciones Adicionales de Seguridad</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. Ingresa con equipo portátil marca Lenovo Serial XYZ123"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {formError && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              fontSize: '12.5px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div className="modal-footer" style={{ margin: '18px -20px -20px', padding: '14px 20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsPassModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || sensorStatus !== 'detected'}
              style={{ gap: '8px' }}
            >
              <Check size={16} />
              <span>{isSubmitting ? 'Registrando...' : 'Vincular Tarjeta y Autorizar Ingreso'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMACIÓN DE DEVOLUCIÓN DE TARJETA */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(returningPass)}
        onClose={() => setReturningPass(null)}
        title="Registrar Devolución de Tarjeta y Salida"
        maxWidth="480px"
      >
        {returningPass && (
          <div>
            <div style={{ marginBottom: '16px', fontSize: '13.5px', lineHeight: 1.5 }}>
              ¿Confirmar la devolución de la tarjeta física{' '}
              <strong className="font-mono" style={{ color: 'var(--accent)' }}>
                {returningPass.card_uid}
              </strong>{' '}
              portada por <strong>{returningPass.full_name}</strong>?
            </div>

            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              fontSize: '12.5px',
              marginBottom: '18px'
            }}>
              <div><strong>Hora de Entrada:</strong> {new Date(returningPass.entry_time).toLocaleTimeString('es-CO')}</div>
              <div><strong>Tiempo en Campus:</strong> {getElapsedTime(returningPass.entry_time)}</div>
              <div><strong>Motivo:</strong> {returningPass.reason}</div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Al registrar la salida, la tarjeta física quedará desvinculada y disponible en el almacén de portería para futuros visitantes.
            </p>

            <div className="modal-footer" style={{ margin: '20px -20px -20px', padding: '14px 20px' }}>
              <button className="btn btn-secondary" onClick={() => setReturningPass(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleConfirmReturn} style={{ gap: '6px' }}>
                <RotateCcw size={15} />
                <span>Confirmar Devolución</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: ENROLAMIENTO PERMANENTE EN INVENTARIO (Solo Admin) */}
      {/* ========================================================================= */}
      {isAdmin && (
        <Modal
          isOpen={isInventoryModalOpen}
          onClose={() => setIsInventoryModalOpen(false)}
          title="Enrolar Tarjeta Fija en Inventario Institucional"
        >
          <form onSubmit={handleEnrollInventoryCard}>
            <div className="form-group">
              <label className="form-label">UID Hexadecimal del Chip RFID</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="Ej. A1B2C3D4 o captura de lector"
                value={invFormData.uid}
                onChange={e => setInvFormData({ ...invFormData, uid: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Asignar a Titular Fijo (Opcional)</label>
              <select
                className="form-select"
                value={invFormData.user_id}
                onChange={e => setInvFormData({ ...invFormData, user_id: e.target.value })}
              >
                <option value="">-- Sin titular (Tarjeta de almacén de portería) --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.document_id}) · {u.role_display}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Tipo de Tarjeta</label>
                <select
                  className="form-select"
                  value={invFormData.card_type}
                  onChange={e => setInvFormData({ ...invFormData, card_type: e.target.value })}
                >
                  <option value="standard">Estándar (Condicionada a Horario)</option>
                  <option value="master">Ficha Maestra (Privilegios Globales)</option>
                  <option value="temporary">Temporal (Pases de Portería)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Etiqueta Identificadora</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Carnet Administrativo"
                  value={invFormData.label}
                  onChange={e => setInvFormData({ ...invFormData, label: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ margin: '14px -20px -20px', padding: '14px 20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsInventoryModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Registrar en Inventario</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
