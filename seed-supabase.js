const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

// Hash bcrypt válido para la contraseña institucional "acceso2026".
// El login web ya es solo por carnet RFID, pero se mantiene un hash válido
// para que la API de autenticación siga funcionando si se usa directamente.
const DEFAULT_PASSWORD_HASH = '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQStaE.dRqEMx5dLbZ0GqL/jgqJDYq';

// ============================================================================
// FOTOS: retratos reales distintos de randomuser.me.
// Cada persona recibe un índice único de hombre/mujer, de modo que ninguna
// foto se repite en toda la base de datos.
// ============================================================================
const photo = (path) => `https://randomuser.me/api/portraits/${path}.jpg`;

// Personas que ya existían en el seed original.
const EXISTING_PEOPLE = [
  { first: 'Mateo',     last: 'Gómez Restrepo',      doc: '1037654120', prog: 'Ingeniería de Sistemas',      role: 5, photo: 'men/30' },
  { first: 'Valentina', last: 'Ochoa Calle',         doc: '1037654121', prog: 'Medicina Veterinaria',        role: 5, photo: 'women/30' },
  { first: 'Sebastián', last: 'Arboleda Ríos',       doc: '1037654122', prog: 'Zootecnia',                   role: 5, photo: 'men/31' },
  { first: 'Camila',    last: 'Londoño Pérez',       doc: '1037654123', prog: 'Ingeniería de Alimentos',     role: 5, photo: 'women/31' },
  { first: 'Santiago',  last: 'Zapata Montoya',      doc: '1037654124', prog: 'Ingeniería de Sistemas',      role: 5, photo: 'men/32' },
  { first: 'Mariana',   last: 'Cardona Mesa',        doc: '1037654125', prog: 'Administración de Empresas',  role: 5, photo: 'women/32' },
  { first: 'Daniel',    last: 'Henao Quintero',      doc: '1037654126', prog: 'Derecho',                     role: 5, photo: 'men/33' },
  { first: 'Isabella',  last: 'Castrillón Ruiz',     doc: '1037654127', prog: 'Medicina Veterinaria',        role: 5, photo: 'women/33' },
  { first: 'Nicolás',   last: 'Vásquez Posada',      doc: '1037654128', prog: 'Zootecnia',                   role: 5, photo: 'men/34' },
  { first: 'Sofía',     last: 'Echeverri Jaramillo', doc: '1037654129', prog: 'Ingeniería de Alimentos',     role: 5, photo: 'women/34' },
  { first: 'Alejandro', last: 'Morales Correa',      doc: '1037654130', prog: 'Ingeniería de Sistemas',      role: 5, photo: 'men/35' },
  { first: 'Laura',     last: 'Ceballos Toro',       doc: '1037654131', prog: 'Licenciatura en Educación',   role: 5, photo: 'women/35' },
  { first: 'Carlos',    last: 'Duque Roldán',        doc: '71234567',   prog: 'Ingeniería de Sistemas',      role: 4, photo: 'men/36' },
  { first: 'Elena',     last: 'Álvarez Peláez',      doc: '43987654',   prog: 'Medicina Veterinaria',        role: 4, photo: 'women/36' }
];

// Nombres para generar 60 personas nuevas (30 mujeres y 30 hombres).
const WOMEN_FIRST = [
  'María Fernanda', 'Luisa', 'Paula', 'Andrea', 'Carolina', 'Juliana', 'Daniela',
  'Natalia', 'Gabriela', 'Manuela', 'Sara', 'Ana María', 'Verónica', 'Catalina',
  'Tatiana', 'Lina', 'Alejandra', 'Diana', 'Mónica', 'Patricia', 'Viviana',
  'Stefany', 'Karen', 'Yuliana', 'Estefanía', 'Melissa', 'Jessica', 'Angélica',
  'Rocío', 'Luz Elena'
];

const MEN_FIRST = [
  'Juan Pablo', 'Andrés', 'Felipe', 'David', 'Miguel Ángel', 'José Luis',
  'Santiago', 'Juan David', 'Esteban', 'Julián', 'Ricardo', 'Óscar', 'Mauricio',
  'Fernando', 'Javier', 'Diego', 'Cristian', 'Iván', 'Hernán', 'Wilson',
  'Freddy', 'Brayan', 'Kevin', 'Jhon', 'Édison', 'Fabián', 'Gustavo',
  'Leonardo', 'Raúl', 'Álvaro'
];

const LAST_NAMES = [
  'Restrepo', 'Gómez', 'Ochoa', 'Arboleda', 'Londoño', 'Zapata', 'Cardona',
  'Henao', 'Castrillón', 'Vásquez', 'Echeverri', 'Morales', 'Ceballos', 'Duque',
  'Álvarez', 'Peláez', 'Jaramillo', 'Correa', 'Mesa', 'Quintero', 'Ríos',
  'Calle', 'Pérez', 'Torres', 'Ramírez', 'Herrera', 'Muñoz', 'Salazar',
  'Giraldo', 'Betancur'
];

const PROGRAMS = [
  'Ingeniería de Sistemas',
  'Medicina Veterinaria',
  'Zootecnia',
  'Ingeniería de Alimentos',
  'Administración de Empresas',
  'Derecho',
  'Licenciatura en Educación',
  'Ingeniería Industrial',
  'Psicología',
  'Contaduría Pública'
];

const GENERATED_PEOPLE = Array.from({ length: 60 }, (_, i) => {
  const female = i % 2 === 0;
  const index = Math.floor(i / 2);
  return {
    first: female ? WOMEN_FIRST[index] : MEN_FIRST[index],
    last: `${LAST_NAMES[i % LAST_NAMES.length]} ${LAST_NAMES[(i * 7 + 3 + Math.floor(i / 30) * 5) % LAST_NAMES.length]}`,
    doc: String(1040000001 + i),
    prog: PROGRAMS[i % PROGRAMS.length],
    role: i % 10 === 0 ? 4 : 5,
    photo: `${female ? 'women' : 'men'}/${index}`
  };
});

const PEOPLE = [...EXISTING_PEOPLE, ...GENERATED_PEOPLE];

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function makeEmail(first, last, doc) {
  return `${slug(first)}.${slug(last)}.${doc}@lasallista.edu.co`;
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🔄 Iniciando sembrado de personas en Supabase...');
    console.log('   (solo usuarios y fotos: no se crean carnets, horarios ni ingresos)');
    await client.query('BEGIN');

    // 1. Insertar o actualizar personas (todas con foto distinta)
    const peopleWithIds = [];
    for (const person of PEOPLE) {
      const email = makeEmail(person.first, person.last, person.doc);
      const res = await client.query(`
        INSERT INTO users (first_name, last_name, document_id, email, password_hash, program, role_id, status, photo_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
        ON CONFLICT (document_id) DO UPDATE
        SET first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            program = EXCLUDED.program,
            role_id = EXCLUDED.role_id,
            status = 'active',
            photo_url = EXCLUDED.photo_url,
            updated_at = NOW()
        RETURNING id;
      `, [
        person.first,
        person.last,
        person.doc,
        email,
        DEFAULT_PASSWORD_HASH,
        person.prog,
        person.role,
        photo(person.photo)
      ]);

      peopleWithIds.push({ ...person, id: res.rows[0].id });
    }
    console.log(`✅ ${peopleWithIds.length} personas aseguradas con foto única.`);

    // 2. Fotos para las cuentas administrativas iniciales (también únicas)
    await client.query(`
      UPDATE users
      SET photo_url = CASE document_id
            WHEN '1000000001' THEN $1
            WHEN '1000000002' THEN $2
          END,
          updated_at = NOW()
      WHERE document_id IN ('1000000001', '1000000002')
        AND (photo_url IS NULL OR photo_url = '');
    `, [photo('men/37'), photo('men/38')]);

    // 3. Verificación de fotos
    const summary = await client.query(`
      SELECT COUNT(*)::int AS total_usuarios,
             COUNT(photo_url)::int AS con_foto,
             COUNT(DISTINCT photo_url)::int AS fotos_distintas,
             COUNT(*) FILTER (WHERE photo_url IS NULL OR photo_url = '')::int AS sin_foto
      FROM users;
    `);
    const duplicates = await client.query(`
      SELECT photo_url, COUNT(*)::int AS cantidad
      FROM users
      WHERE photo_url IS NOT NULL
      GROUP BY photo_url
      HAVING COUNT(*) > 1;
    `);

    await client.query('COMMIT');

    const s = summary.rows[0];
    console.log('');
    console.log('📊 Resumen del sembrado:');
    console.log(`   👥 Usuarios: ${s.total_usuarios} | con foto: ${s.con_foto} | fotos distintas: ${s.fotos_distintas} | sin foto: ${s.sin_foto}`);
    if (duplicates.rowCount > 0) {
      console.warn(`   ⚠️ Hay ${duplicates.rowCount} foto(s) repetida(s). Revisa la tabla users.`);
    } else {
      console.log('   ✅ Todas las fotos son diferentes.');
    }
    console.log('');
    console.log('ℹ️  No se crearon carnets RFID, horarios ni registros de acceso.');
    console.log('   La vinculación de carnets se realiza desde el propio sistema.');
    console.log('🎉 Sembrado de personas completado.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('❌ Error sembrando base de datos:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
