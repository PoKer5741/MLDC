const { sql, poolPromise } = require('./db');

async function procesarRiesgo() {
    try {
        const pool = await poolPromise;
        await pool.request().execute('dbo.sp_ProcesarRiesgoMasivo');
    } catch (error) {
        throw new Error(`Fallo en el SP de Riesgo: ${error.message}`);
    }
}

async function calcularRiesgoClienteIndividual(req, res) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);
        const { provincia, canton, profesion, ingresos, edad, tipoSociedad, estadoCivil } = req.body;
        
        const result = await request
            .input('Id_Cliente', sql.Int, parseInt(req.params.idCliente))
            .input('Provincia', sql.VarChar(100), provincia || 'San José')
            .input('Canton', sql.VarChar(100), canton || 'Central')
            .input('Profesion', sql.VarChar(100), profesion || '')
            .input('Ingresos', sql.Decimal(22, 2), ingresos || 0)
            .input('Edad', sql.Int, edad || 30)
            .input('TipoSociedad', sql.Int, tipoSociedad || 1)
            .input('EstadoCivil', sql.VarChar(50), estadoCivil || 'Soltero(a)')
            .execute('dbo.sp_CalcularRiesgoIndividualParametrico');

        await transaction.commit();
        res.json({ mensaje: 'Cálculo procesado.', datos: result.recordset[0] });
    } catch (error) {
        if (transaction._bp) await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
}

async function guardarRiesgoManualCliente(req, res) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);
        const { p1, p2, p3, p4, p5, p6, p7, p8 } = req.body;
        
        const result = await request
            .input('Id_Cliente', sql.Int, parseInt(req.params.idCliente))
            .input('P_1', sql.Decimal(5, 2), p1).input('P_2', sql.Decimal(5, 2), p2)
            .input('P_3', sql.Decimal(5, 2), p3).input('P_4', sql.Decimal(5, 2), p4)
            .input('P_5', sql.Decimal(5, 2), p5).input('P_6', sql.Decimal(5, 2), p6)
            .input('P_7', sql.Decimal(5, 2), p7).input('P_8', sql.Decimal(5, 2), p8)
            .execute('dbo.sp_GuardarRiesgoManual');

        await transaction.commit();
        res.json({ mensaje: 'Ajuste manual asentado.', datos: result.recordset[0] });
    } catch (error) {
        if (transaction._bp) await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
}

module.exports = { procesarRiesgo, calcularRiesgoClienteIndividual, guardarRiesgoManualCliente };