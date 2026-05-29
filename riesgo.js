const { poolPromise } = require('./db');

async function procesarRiesgo() {
    try {
        const pool = await poolPromise;
        await pool.request().execute('dbo.sp_ProcesarRiesgoMasivo');
        console.log('[RIESGO] Evaluacion masiva CICAC ejecutada correctamente en SQL Server.');
    } catch (error) {
        console.error('[ERROR RIESGO] Fallo en el motor de base de datos:', error.message);
        throw new Error(`Fallo en el SP de Riesgo: ${error.message}`);
    }
}

module.exports = { procesarRiesgo };