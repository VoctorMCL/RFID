import React, { useState } from 'react';
import { Download, Filter, Search, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

export default function Historial({ accesos, personas, tarjetas, torniquetes }) {
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const accesosConDetalle = accesos.map((a) => {
    const tarjeta = tarjetas.find((t) => t.id_tarjeta === a.id_tarjeta || t.uid === a.uid_leido);
    const persona = tarjeta && tarjeta.id_persona
      ? personas.find((p) => p.id_persona === tarjeta.id_persona)
      : null;
    const torniquete = torniquetes.find((t) => t.id_torniquete === a.id_torniquete);
    return { ...a, persona, tarjeta, torniquete };
  });

  const accesosFiltrados = accesosConDetalle.filter((a) => {
    if (filtro === 'permitidos' && a.resultado !== 'permitido') return false;
    if (filtro === 'denegados' && a.resultado === 'permitido') return false;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const nombre = a.persona ? `${a.persona.nombre} ${a.persona.apellido}`.toLowerCase() : '';
      const doc = a.persona?.documento_identidad || '';
      const uid = a.uid_leido?.toLowerCase() || '';
      return nombre.includes(q) || doc.includes(q) || uid.includes(q);
    }
    return true;
  });

  const exportarCSV = () => {
    const headers = ['ID', 'Fecha y Hora', 'UID', 'Persona', 'Documento', 'Torniquete', 'Resultado', 'Tiempo (ms)'];
    const rows = accesosFiltrados.map((a) => [
      a.id_acceso,
      a.fecha_hora,
      a.uid_leido,
      a.persona ? `"${a.persona.nombre} ${a.persona.apellido}"` : 'Desconocido',
      a.persona?.documento_identidad || 'N/A',
      a.torniquete ? `"${a.torniquete.nombre}"` : 'Torniquete 1',
      a.resultado,
      a.tiempo_respuesta_ms || 120
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historial_accesos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getResultadoBadge = (res) => {
    if (res === 'permitido') {
      return (
        <span className="pill pill-ok">
          <CheckCircle2 size={12} /> Permitido
        </span>
      );
    }
    return (
      <span className="pill pill-fail">
        <XCircle size={12} /> {res.replace('denegado_', '')}
      </span>
    );
  };

  return (
    <div>
      {/* Controles de Filtrado y Exportación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              className="input-text"
              style={{ width: '100%', paddingLeft: '34px' }}
              placeholder="Buscar por nombre, documento o UID..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
            <button
              className={`btn btn-sm ${filtro === 'todos' ? 'btn-primary' : ''}`}
              onClick={() => setFiltro('todos')}
            >
              Todos
            </button>
            <button
              className={`btn btn-sm ${filtro === 'permitidos' ? 'btn-primary' : ''}`}
              onClick={() => setFiltro('permitidos')}
            >
              Permitidos
            </button>
            <button
              className={`btn btn-sm ${filtro === 'denegados' ? 'btn-primary' : ''}`}
              onClick={() => setFiltro('denegados')}
            >
              Denegados
            </button>
          </div>
        </div>

        <button className="btn btn-outline" onClick={exportarCSV}>
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      {/* Tabla de Historial */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>UID de Tarjeta</th>
              <th>Persona Titular</th>
              <th>Torniquete</th>
              <th>Resultado</th>
              <th>Latencia</th>
            </tr>
          </thead>
          <tbody>
            {accesosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                  No hay registros de acceso que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              accesosFiltrados.map((a) => (
                <tr key={a.id_acceso}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                    {a.fecha_hora ? new Date(a.fecha_hora).toLocaleString('es-CO') : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {a.uid_leido}
                  </td>
                  <td>
                    {a.persona ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.persona.nombre} {a.persona.apellido}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          CC {a.persona.documento_identidad} • {a.persona.programa || a.persona.tipo_persona}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No identificada</span>
                    )}
                  </td>
                  <td>{a.torniquete?.nombre || 'Torniquete Principal'}</td>
                  <td>{getResultadoBadge(a.resultado)}</td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: 'var(--ok)'
                      }}
                    >
                      <Zap size={11} /> {a.tiempo_respuesta_ms || 115} ms
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
