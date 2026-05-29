
const sql = require('mssql/msnodesqlv8');

const config = {
    connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=POKER;Database=Grupo3_IF51002026;Trusted_Connection=yes;',
    options: { trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 15000
};

async function diagnosticar() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║     DIAGNÓSTICO DE BASE DE DATOS         ║');
    console.log('╚══════════════════════════════════════════╝\n');

    // ── PASO 1: Conexión ──────────────────────────
    console.log('[ 1/5 ] Intentando conectar a SQL Server...');
    let pool;
    try {
        pool = await new sql.ConnectionPool(config).connect();
        console.log('        ✅ CONEXIÓN EXITOSA\n');
    } catch (err) {
        console.error('        ❌ FALLO DE CONEXIÓN:', err.message);
        console.log('\n  Causas posibles:');
        console.log('  → El servidor "POKER" no está encendido o no es accesible');
        console.log('  → ODBC Driver 17 no está instalado en esta máquina');
        console.log('  → La base de datos "Grupo3_IF51002026" no existe');
        console.log('  → Tu usuario de Windows no tiene permisos (Trusted_Connection)');
        process.exit(1);
    }

    // ── PASO 2: ¿Existe la base de datos? ────────
    console.log('[ 2/5 ] Verificando base de datos actual...');
    try {
        const r = await pool.request().query('SELECT DB_NAME() AS BaseDeDatos, SYSTEM_USER AS Usuario');
        console.log('        ✅ Base de datos:', r.recordset[0].BaseDeDatos);
        console.log('        ✅ Usuario conectado:', r.recordset[0].Usuario, '\n');
    } catch (err) {
        console.error('        ❌', err.message, '\n');
    }

    // ── PASO 3: ¿Existe T_Persona? ───────────────
    console.log('[ 3/5 ] Verificando tabla T_Persona...');
    try {
        const r = await pool.request().query(`
            SELECT COUNT(*) AS Total FROM dbo.T_Persona WITH (NOLOCK)
        `);
        console.log('        ✅ T_Persona existe — Total de filas:', r.recordset[0].Total, '\n');
    } catch (err) {
        console.error('        ❌ T_Persona no accesible:', err.message);
        console.log('           Verifica que la tabla existe y tienes permisos SELECT\n');
    }

    // ── PASO 4: Muestra 3 personas reales ────────
    console.log('[ 4/5 ] Leyendo 3 personas de muestra...');
    try {
        const r = await pool.request().query(`
            SELECT TOP 3 C_IdPersona, D_Nombre, D_PrimerApellido 
            FROM dbo.T_Persona WITH (NOLOCK)
        `);
        if (r.recordset.length === 0) {
            console.log('        ⚠️  La tabla T_Persona está VACÍA — no hay datos que buscar\n');
        } else {
            console.log('        ✅ Muestra de datos:');
            r.recordset.forEach(p => {
                console.log(`           → ID: ${p.C_IdPersona} | ${p.D_Nombre} ${p.D_PrimerApellido}`);
            });
            console.log('');
        }
    } catch (err) {
        console.error('        ❌', err.message, '\n');
    }

    // ── PASO 5: Prueba la búsqueda real ──────────
    console.log('[ 5/5 ] Probando búsqueda con LIKE...');
    try {
        // Primero obtiene una letra/número que exista para buscar
        const muestra = await pool.request().query(`
            SELECT TOP 1 LEFT(D_PrimerApellido, 3) AS Prefijo 
            FROM dbo.T_Persona WITH (NOLOCK) WHERE D_PrimerApellido IS NOT NULL
        `);
        const prefijo = muestra.recordset[0]?.Prefijo || 'MOR';

        const r = await pool.request()
            .input('t', sql.VarChar, `%${prefijo}%`)
            .query(`
                SELECT TOP 5 C_IdPersona, D_Nombre, D_PrimerApellido
                FROM dbo.T_Persona WITH (NOLOCK)
                WHERE D_PrimerApellido COLLATE Latin1_General_CI_AI LIKE @t
            `);

        console.log(`        ✅ Búsqueda por "${prefijo}" devolvió ${r.recordset.length} resultado(s):`);
        r.recordset.forEach(p => {
            console.log(`           → ${p.C_IdPersona} | ${p.D_Nombre} ${p.D_PrimerApellido}`);
        });
    } catch (err) {
        console.error('        ❌ Fallo en búsqueda:', err.message);
    }

    await pool.close();
    console.log('\n══════════════════════════════════════════');
    console.log(' Diagnóstico completo. Revisa los ❌ arriba.');
    console.log('══════════════════════════════════════════\n');
}

diagnosticar();
