import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import {
  History,
  Search,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Building
} from 'lucide-react';

export const AccessLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });

  const loadLogs = async () => {
    try {
      setLoading(true);
      let query = `?page=${page}&limit=25`;
      if (statusFilter === 'granted') query += '&granted=true';
      if (statusFilter === 'denied') query += '&granted=false';
      if (search) query += `&search=${encodeURIComponent(search)}`;

      const res = await apiClient(`/access/logs${query}`);
      if (res.success) {
        setLogs(res.data);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Error cargando historial de accesos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadLogs();
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Fecha/Hora', 'Persona', 'Documento', 'UID RFID', 'Puerta', 'Sala', 'Resultado', 'Motivo'];
    const rows = logs.map(l => [
      l.timestamp,
      l.user_name,
      l.user_document,
      l.rfid_uid_raw,
      l.door_name,
      l.room_name,
      l.granted ? 'Concedido' : 'Denegado',
      l.denial_reason || '—'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_accesos_rfid_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.toLocaleDateString('es-CO')} ${d.toLocaleTimeString('es-CO', { hour12: false })}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Historial de Accesos y Auditoría de Seguridad</h1>
          <p className="page-subtitle">
            Trazabilidad completa de lecturas RFID, puertas franqueadas y violaciones de seguridad
          </p>
        </div>
        <button onClick={handleExportCSV} className="btn btn-secondary btn-sm">
          <Download size={14} />
          <span>Exportar Auditoría CSV</span>
        </button>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Buscar por nombre, documento, UID RFID, puerta o sala..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <select
            className="form-select"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Todos los Intentos</option>
            <option value="granted">Solo Concedidos</option>
            <option value="denied">Solo Denegados</option>
          </select>

          <button type="submit" className="btn btn-primary">
            <span>Buscar</span>
          </button>
        </form>
      </div>

      {/* Tabla de Logs */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Persona / Titular</th>
              <th>UID Tarjeta RFID</th>
              <th>Puerta y Sala</th>
              <th>Método</th>
              <th>Resultado</th>
              <th>Observación / Causa</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No se encontraron registros de acceso.
                </td>
              </tr>
            ) : (
              logs.map(l => (
                <tr key={l.id}>
                  <td className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDate(l.timestamp)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.user_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Doc: {l.user_document}</div>
                  </td>
                  <td className="font-mono" style={{ fontSize: '12.5px' }}>
                    {l.rfid_uid_raw || '—'}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.door_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{l.room_name} ({l.block_name})</div>
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                      {l.access_method?.toUpperCase() || 'RFID'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${l.granted ? 'badge-ok' : 'badge-denied'}`}>
                      {l.granted ? 'Concedido' : 'Denegado'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {l.denial_reason ? (
                      <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>{l.denial_reason}</span>
                    ) : (
                      <span>{l.notes || 'Autorizado'}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
        <div>Total de registros: <b>{pagination.total}</b></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary btn-sm"
          >
            Anterior
          </button>
          <span style={{ padding: '6px 12px', alignSelf: 'center' }}>
            Página {page} de {pagination.pages || 1}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.pages || 1, p + 1))}
            disabled={page >= pagination.pages}
            className="btn btn-secondary btn-sm"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
};
