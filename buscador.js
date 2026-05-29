const { sql, poolPromise } = require('./db');

async function buscarClienteInteligente(termino, opciones = {}) {
    const pool = await poolPromise;
    const t = String(termino || '').trim();
    const { provincia, canton, distrito } = opciones;

    try {
        const request = pool.request();
        
        if (t.length >= 2) {
            request.input('Termino', sql.VarChar(200), t);
        }
        if (provincia && provincia !== "") {
            request.input('IdProvincia', sql.Int, parseInt(provincia));
        }
        if (canton && canton !== "") {
            request.input('IdCanton', sql.Int, parseInt(canton));
        }
        if (distrito && distrito !== "") {
            request.input('IdDistrito', sql.Int, parseInt(distrito));
        }

        const result = await request.execute('dbo.sp_BuscarPadronInteligente');
        return result.recordset;
    } catch (err) {
        console.error('[ERROR BUSCADOR]', err.message);
        return [];
    }
}

async function obtenerProvincias() {
    const pool = await poolPromise;
    const r = await pool.request().execute('dbo.sp_ObtenerProvincias');
    return r.recordset;
}

async function obtenerCantones(idProvincia) {
    const pool = await poolPromise;
    const r = await pool.request()
        .input('Id_Provincia', sql.Int, parseInt(idProvincia))
        .execute('dbo.sp_ObtenerCantones');
    return r.recordset;
}

async function obtenerDistritos(idCanton) {
    const pool = await poolPromise;
    const r = await pool.request()
        .input('Id_Canton', sql.Int, parseInt(idCanton))
        .execute('dbo.sp_ObtenerDistritos');
    return r.recordset;
}

module.exports = { buscarClienteInteligente, obtenerProvincias, obtenerCantones, obtenerDistritos };