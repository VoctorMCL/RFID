import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import {
  Building2,
  DoorOpen,
  Plus,
  Trash2,
  Edit,
  Shield,
  Camera,
  Eye,
  AlertTriangle,
  Lock,
  Unlock,
  Check
} from 'lucide-react';

export const InstitutionalMap = () => {
  const { canManageInfrastructure, canManageSecurity } = useAuth();
  const [blocks, setBlocks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [doors, setDoors] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modales
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isDoorModalOpen, setIsDoorModalOpen] = useState(false);

  // Formularios
  const [blockForm, setBlockForm] = useState({ name: '', description: '', location_info: '' });
  const [roomForm, setRoomForm] = useState({
    name: '',
    floor: 1,
    room_type: 'lab_informatica',
    has_alarm: false,
    has_camera: false,
    motion_sensors: 0,
    door_sensors: 0,
    description: ''
  });
  const [doorForm, setDoorForm] = useState({
    name: '',
    door_type: 'acceso',
    hardware_ip: '192.168.1.100',
    mac_address: 'AA:BB:CC:DD:EE:01'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [blocksRes, roomsRes, doorsRes] = await Promise.all([
        apiClient('/blocks'),
        apiClient('/rooms'),
        apiClient('/doors')
      ]);

      if (blocksRes.success) {
        setBlocks(blocksRes.data);
        if (blocksRes.data.length > 0 && !selectedBlock) {
          setSelectedBlock(blocksRes.data[0]);
        }
      }
      if (roomsRes.success) setRooms(roomsRes.data);
      if (doorsRes.success) setDoors(doorsRes.data);
    } catch (err) {
      console.error('Error cargando infraestructura institucional:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Manejadores de Creación Dinámica (Bloques, Salas, Puertas)
  const handleCreateBlock = async (e) => {
    e.preventDefault();
    try {
      const res = await apiClient('/blocks', {
        method: 'POST',
        body: blockForm
      });
      if (res.success) {
        setBlocks(prev => [...prev, res.data]);
        setSelectedBlock(res.data);
        setIsBlockModalOpen(false);
        setBlockForm({ name: '', description: '', location_info: '' });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!selectedBlock) return;
    try {
      const res = await apiClient('/rooms', {
        method: 'POST',
        body: {
          ...roomForm,
          block_id: selectedBlock.id
        }
      });
      if (res.success) {
        setRooms(prev => [...prev, res.data]);
        setSelectedRoom(res.data);
        setIsRoomModalOpen(false);
        setRoomForm({
          name: '',
          floor: 1,
          room_type: 'lab_informatica',
          has_alarm: false,
          has_camera: false,
          motion_sensors: 0,
          door_sensors: 0,
          description: ''
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateDoor = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;
    try {
      const res = await apiClient('/doors', {
        method: 'POST',
        body: {
          ...doorForm,
          room_id: selectedRoom.id
        }
      });
      if (res.success) {
        setDoors(prev => [...prev, res.data]);
        setIsDoorModalOpen(false);
        setDoorForm({
          name: '',
          door_type: 'acceso',
          hardware_ip: '192.168.1.100',
          mac_address: 'AA:BB:CC:DD:EE:01'
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUnlockDoor = async (doorId) => {
    try {
      const res = await apiClient(`/doors/${doorId}/unlock`, { method: 'POST' });
      if (res.success) {
        alert('Comando de apertura remota enviado. La puerta se mantendrá abierta por 5 segundos.');
        loadData();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBlock = async (id) => {
    if (!window.confirm('¿Desea eliminar este bloque?')) return;
    try {
      const res = await apiClient(`/blocks/${id}`, { method: 'DELETE' });
      if (res.success) {
        setBlocks(prev => prev.filter(b => b.id !== id));
        if (selectedBlock?.id === id) setSelectedBlock(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!window.confirm('¿Desea eliminar esta sala?')) return;
    try {
      const res = await apiClient(`/rooms/${id}`, { method: 'DELETE' });
      if (res.success) {
        setRooms(prev => prev.filter(r => r.id !== id));
        if (selectedRoom?.id === id) setSelectedRoom(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const currentRooms = selectedBlock
    ? rooms.filter(r => r.block_id === selectedBlock.id)
    : [];

  const currentDoors = selectedRoom
    ? doors.filter(d => d.room_id === selectedRoom.id)
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mapa Institucional y Arquitectura Física</h1>
          <p className="page-subtitle">
            Gestión dinámica de Bloques, Salas y Puertas Inteligentes con Hardware RFID
          </p>
        </div>
        {canManageInfrastructure && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => setIsBlockModalOpen(true)}>
              <Plus size={16} />
              <span>Crear Bloque</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid de 3 Columnas: Bloques -> Salas -> Puertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1.3fr', gap: '20px', alignItems: 'start' }}>
        
        {/* COLUMNA 1: BLOQUES INSTITUCIONALES */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Building2 size={18} />
              <span>1. Bloques del Campus</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{blocks.length} registrados</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {blocks.map(b => (
              <div
                key={b.id}
                onClick={() => {
                  setSelectedBlock(b);
                  setSelectedRoom(null);
                }}
                style={{
                  padding: '12px 14px',
                  backgroundColor: selectedBlock?.id === b.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  border: `1px solid ${selectedBlock?.id === b.id ? 'var(--accent-border)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: selectedBlock?.id === b.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {b.location_info || b.description || 'Sin descripción'}
                  </div>
                </div>
                {canManageInfrastructure && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteBlock(b.id); }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 6px' }}
                    title="Eliminar bloque"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* COLUMNA 2: SALAS DEL BLOQUE SELECCIONADO */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <DoorOpen size={18} />
              <span>2. Salas en {selectedBlock?.name || '...'}</span>
            </div>
            {selectedBlock && canManageInfrastructure && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsRoomModalOpen(true)}
              >
                <Plus size={14} />
                <span>Nueva Sala</span>
              </button>
            )}
          </div>

          {!selectedBlock ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Seleccione un bloque para ver sus salas.
            </div>
          ) : currentRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No hay salas creadas en este bloque aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentRooms.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoom(r)}
                  style={{
                    padding: '12px 14px',
                    backgroundColor: selectedRoom?.id === r.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    border: `1px solid ${selectedRoom?.id === r.id ? 'var(--accent-border)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: selectedRoom?.id === r.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Piso {r.floor} · Tipo: {r.room_type}
                      </div>
                    </div>
                    {canManageInfrastructure && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRoom(r.id); }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 6px' }}
                        title="Eliminar sala"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Sensores y Alarma */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {r.has_alarm && (
                      <span className="badge badge-alert" style={{ fontSize: '10px' }}>
                        <Shield size={10} /> Alarma Física
                      </span>
                    )}
                    {r.has_camera && (
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        <Camera size={10} /> Cámara
                      </span>
                    )}
                    {r.motion_sensors > 0 && (
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        <Eye size={10} /> {r.motion_sensors} Movimiento
                      </span>
                    )}
                    {r.door_sensors > 0 && (
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        <DoorOpen size={10} /> {r.door_sensors} Sensor Puerta
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA 3: PUERTAS CON HARDWARE RFID */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Lock size={18} />
              <span>3. Puertas y Hardware RFID</span>
            </div>
            {selectedRoom && canManageInfrastructure && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsDoorModalOpen(true)}
              >
                <Plus size={14} />
                <span>Nueva Puerta</span>
              </button>
            )}
          </div>

          {!selectedRoom ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Seleccione una sala para inspeccionar sus puertas inteligentes.
            </div>
          ) : currentDoors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Esta sala no tiene puertas RFID registradas aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentDoors.map(d => (
                <div
                  key={d.id}
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{d.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Acceso ID: {d.id} ({d.door_type || 'acceso'})
                      </div>
                    </div>
                    <span className="badge badge-ok">ONLINE</span>
                  </div>

                  <div style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    marginBottom: '10px'
                  }}>
                    IP: {d.hardware_ip || '192.168.1.100'} · MAC: {d.mac_address || 'AA:BB:CC:DD:EE:01'}
                  </div>

                  {canManageSecurity && (
                    <button
                      onClick={() => handleUnlockDoor(d.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Unlock size={14} />
                      <span>Apertura Remota de Emergencia</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: CREAR BLOQUE */}
      <Modal isOpen={isBlockModalOpen} onClose={() => setIsBlockModalOpen(false)} title="Crear Bloque Institucional">
        <form onSubmit={handleCreateBlock}>
          <div className="form-group">
            <label className="form-label">Nombre del Bloque</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Bloque D - Laboratorios Avanzados"
              value={blockForm.name}
              onChange={e => setBlockForm({ ...blockForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Ubicación en el Campus</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Costado oriental, frente a la plazoleta"
              value={blockForm.location_info}
              onChange={e => setBlockForm({ ...blockForm, location_info: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="Detalles de facultades y áreas que alberga..."
              value={blockForm.description}
              onChange={e => setBlockForm({ ...blockForm, description: e.target.value })}
            />
          </div>
          <div className="modal-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsBlockModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar Bloque</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREAR SALA */}
      <Modal isOpen={isRoomModalOpen} onClose={() => setIsRoomModalOpen(false)} title={`Crear Sala en ${selectedBlock?.name}`}>
        <form onSubmit={handleCreateRoom}>
          <div className="form-group">
            <label className="form-label">Nombre de la Sala / Espacio</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Sala de Informática 7"
              value={roomForm.name}
              onChange={e => setRoomForm({ ...roomForm, name: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Piso</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-input"
                value={roomForm.floor}
                onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Espacio</label>
              <select
                className="form-select"
                value={roomForm.room_type}
                onChange={e => setRoomForm({ ...roomForm, room_type: e.target.value })}
              >
                <option value="lab_informatica">Laboratorio de Informática</option>
                <option value="lab_ingenieria">Laboratorio de Ingeniería</option>
                <option value="administrativo">Oficina Administrativa</option>
                <option value="financiero">Oficina Financiera</option>
                <option value="biblioteca">Biblioteca / Sala de Estudio</option>
                <option value="auditorio">Auditorio</option>
                <option value="general">Aula General</option>
              </select>
            </div>
          </div>

          {/* Opciones de Seguridad y Sensores */}
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Sensores de Seguridad Físicos:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={roomForm.has_alarm}
                  onChange={e => setRoomForm({ ...roomForm, has_alarm: e.target.checked })}
                />
                <span>Cuenta con Sistema de Alarma Integrada</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={roomForm.has_camera}
                  onChange={e => setRoomForm({ ...roomForm, has_camera: e.target.checked })}
                />
                <span>Cámara de Seguridad Activa</span>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <div>
                <label className="form-label">Sensores de Movimiento</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={roomForm.motion_sensors}
                  onChange={e => setRoomForm({ ...roomForm, motion_sensors: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Sensores de Puerta</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={roomForm.door_sensors}
                  onChange={e => setRoomForm({ ...roomForm, door_sensors: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '14px -20px -20px', padding: '14px 20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsRoomModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Registrar Sala</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREAR PUERTA */}
      <Modal isOpen={isDoorModalOpen} onClose={() => setIsDoorModalOpen(false)} title={`Registrar Puerta en ${selectedRoom?.name}`}>
        <form onSubmit={handleCreateDoor}>
          <div className="form-group">
            <label className="form-label">Nombre / Ubicación de la Puerta</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Puerta Principal, Puerta Lateral Derecha..."
              value={doorForm.name}
              onChange={e => setDoorForm({ ...doorForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo de Acceso</label>
            <select
              className="form-select"
              value={doorForm.door_type}
              onChange={e => setDoorForm({ ...doorForm, door_type: e.target.value })}
            >
              <option value="acceso">Acceso Estándar</option>
              <option value="acceso_1">Acceso 1</option>
              <option value="acceso_2">Acceso 2</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">IP del Microcontrolador (ESP32)</label>
              <input
                type="text"
                className="form-input"
                placeholder="192.168.1.100"
                value={doorForm.hardware_ip}
                onChange={e => setDoorForm({ ...doorForm, hardware_ip: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Dirección MAC</label>
              <input
                type="text"
                className="form-input"
                placeholder="AA:BB:CC:DD:EE:01"
                value={doorForm.mac_address}
                onChange={e => setDoorForm({ ...doorForm, mac_address: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-footer" style={{ margin: '0 -20px -20px', padding: '14px 20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsDoorModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Registrar Puerta RFID</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
