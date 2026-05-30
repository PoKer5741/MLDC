const { create } = require('xmlbuilder2');
const fs = require('fs');
const { poolPromise, sql } = require('./db');

async function generarXMLSicveca() {
    const pool = await poolPromise;

    try {
        console.log('[XML] Solicitando validacion e informacion al motor de base de datos...');
        
        // 1. Obtener parámetros dinámicos institucionales de la base de datos
        const pDependencia = await pool.request().input('Id_Parametro', sql.VarChar(50), 'XML_TIPO_DEPENDENCIA').execute('dbo.sp_ObtenerParametro');
        const pNombre = await pool.request().input('Id_Parametro', sql.VarChar(50), 'XML_NOMBRE_DEPENDENCIA').execute('dbo.sp_ObtenerParametro');
        const pRiesgo = await pool.request().input('Id_Parametro', sql.VarChar(50), 'XML_RIESGO_DEPENDENCIA').execute('dbo.sp_ObtenerParametro');
        const pPais = await pool.request().input('Id_Parametro', sql.VarChar(50), 'XML_PAIS_ISO').execute('dbo.sp_ObtenerParametro');

        const tipoDependencia = pDependencia.recordset[0].Valor_Texto;
        const nombreDependencia = pNombre.recordset[0].Valor_Texto;
        const riesgoDependencia = pRiesgo.recordset[0].Valor_Texto;
        const codigoPais = pPais.recordset[0].Valor_Texto;

        const result = await pool.request().execute('dbo.sp_ObtenerDatosXML_Sicveca');

        const cabecera = result.recordsets[0][0];
        const transferencias = result.recordsets[1];

        const anio = cabecera.Anio;
        const mesActual = cabecera.MesActual;
        const totalClientes = cabecera.TotalClientes;
        // Si el SP Sicveca retorna el riesgo del cliente, utilízalo. Si no, usa el valor por defecto provisto por la BD.
        const riesgoClienteXML = cabecera.TipoRiesgoCliente || 'Moderado'; 

        const root = create({ version: '1.0', encoding: 'UTF-8' })
            .ele('Registro', { id: '', accion: '' });

        root.ele('Anio').txt(anio.toString());

        const listaZonas = root.ele('ListaZonaGeografica');
        const elementoZona = listaZonas.ele('ElementoZonaGeografica');
        
        elementoZona.ele('MesActual').txt(mesActual.toString());
        elementoZona.ele('TipoDependencia').txt(tipoDependencia); 
        elementoZona.ele('NombreDependencia').txt(nombreDependencia); 
        elementoZona.ele('TipoRiesgoCliente').txt(riesgoClienteXML); 
        elementoZona.ele('CantidadClientes').txt(totalClientes.toString());
        elementoZona.ele('TipoRiesgoDependencia').txt(riesgoDependencia);

        const listaTransferencias = root.ele('ListaTransferenciasRemesas');

        if (transferencias && transferencias.length > 0) {
            for (const row of transferencias) {
                const tipoMovimiento = row.C_TipoProducto === 13 ? '1' : '2'; 
                
                const elementoTransferencia = listaTransferencias.ele('ElementoTransferenciasRemesas');
                elementoTransferencia.ele('Mes').txt(mesActual.toString());
                elementoTransferencia.ele('TipoMovimiento').txt(tipoMovimiento);
                elementoTransferencia.ele('TipoEntradaSalidaFondos').txt('1'); 
                elementoTransferencia.ele('MontoTotal').txt(row.MontoTotal ? row.MontoTotal.toFixed(2) : '0.00');
                elementoTransferencia.ele('CodigoPaisISO').txt(codigoPais); 
            }
        } else {
            const elementoTransferencia = listaTransferencias.ele('ElementoTransferenciasRemesas');
            elementoTransferencia.ele('Mes').txt(mesActual.toString());
            elementoTransferencia.ele('TipoMovimiento').txt('1');
            elementoTransferencia.ele('TipoEntradaSalidaFondos').txt('1');
            elementoTransferencia.ele('MontoTotal').txt('0.00');
            elementoTransferencia.ele('CodigoPaisISO').txt(codigoPais);
        }

        const xmlString = root.end({ prettyPrint: true });
        fs.writeFileSync('Sicveca_Reporte.xml', xmlString, 'utf-8');
        console.log('[XML] Documento "Sicveca_Reporte.xml" procesado y exportado.');

    } catch (err) {
        console.error('[ERROR PROCESO XML]', err.message);
        throw err;
    }
}

module.exports = { generarXMLSicveca };