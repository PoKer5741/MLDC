const { create } = require('xmlbuilder2');
const fs = require('fs');
const { poolPromise } = require('./db');

function fmt(v) { return parseFloat(v || 0).toFixed(2); }
function num(v) { return (v || 0).toString(); }

async function generarXMLSicveca() {
    const pool = await poolPromise;
    
    // Invocamos el SP que ya tienes creado en tu BD y que devuelve los 14 Recordsets
    const result = await pool.request().execute('dbo.sp_GenerarDatosXML_Sicveca');

    const cab = result.recordsets[0][0];
    const A = result.recordsets[1] || [];
    const B = result.recordsets[2] || [];
    const C1 = result.recordsets[3] || [];
    const C2 = result.recordsets[4] || [];
    const D = result.recordsets[5] || [];
    const E = result.recordsets[6] || [];
    const F = result.recordsets[7] || [];
    const G = result.recordsets[8] || [];
    const H = result.recordsets[9] || [];
    const I = result.recordsets[10] || [];
    const J = result.recordsets[11] || [];
    const K = result.recordsets[12] || [];
    const L = result.recordsets[13] || [];

     
    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('ArchivoSICVECA');

    // 2. BLOQUE DE ENCABEZADO  
    const encabezado = root.ele('Encabezado');
    encabezado.ele('ClaseDato').txt('1');
    encabezado.ele('VersionClaseDato').txt('1.0');
    encabezado.ele('Archivo').txt('1');
    encabezado.ele('VersionArchivo').txt('1.0');
    
     
    const today = new Date();
    const qEnd = new Date(today.getFullYear(), Math.floor((today.getMonth() / 3) + 1) * 3, 0);
    const formatoPeriodo = `${String(qEnd.getDate()).padStart(2, '0')}/${String(qEnd.getMonth() + 1).padStart(2, '0')}/${qEnd.getFullYear()}`;
    
    encabezado.ele('Periodo').txt(formatoPeriodo);
    encabezado.ele('IdEntidad').txt('3-101-123456'); 
    encabezado.ele('TipoCarga').txt('1');  
    encabezado.ele('TipoMoneda').txt('1'); 

    // 3. BLOQUE DE DATOS
    const datos = root.ele('Datos');
    const registro = datos.ele('Registro', { id: num(cab.IdRegistro || 1), accion: 'insertar' });
    registro.ele('Anio').txt(num(cab.Anio));

    // CUADRO A: Total Clientes por Riesgo
    const listaA = registro.ele('ListaTotalClientesPorRiesgo');
    for (const r of A) {
        const e = listaA.ele('ElementoTotalClientesPorRiesgo');
        e.ele('Mes_ClientesPorRiesgo').txt(num(r.Mes));
        e.ele('TipoRiesgo_ClientesPorRiesgo').txt(num(r.C_TipoRiesgo || 1));
        e.ele('Total_ClientesPorRiesgo').txt(num(r.TotalClientes));
    }

    // CUADRO B: Nuevos, Cerrados e Inactivos
    const listaB = registro.ele('ListaClientesNuevosCerradosEInactivos');
    for (const r of B) {
        const e = listaB.ele('ElementoClientesNuevosCerradosEInactivos');
        e.ele('Mes_ClientesNuevosCerradosEInactivos').txt(num(r.Mes));
        e.ele('TipoOperacion_ClientesNuevosCerradosEInactivos').txt(num(r.TipoOperacion || 1));
        e.ele('TipoEstadoCliente_ClientesNuevosCerradosEInactivos').txt(num(r.TipoEstadoCliente || 1));
        e.ele('NumeroClientes_ClientesNuevosCerradosEInactivos').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesNuevosCerradosEInactivos').txt(fmt(r.PorcentajeClientes));
    }

    // CUADRO C1: Tipo Persona
    const listaC1 = registro.ele('ListaClientesPorTipoPersona');
    for (const r of C1) {
        const e = listaC1.ele('ElementoClientesPorTipoPersona');
        e.ele('Mes_ClientesPorTipoPersona').txt(num(r.Mes));
        e.ele('TipoPersonaCliente_ClientesPorTipoPersona').txt(num(r.TipoPersona || 1));
        e.ele('NumeroClientes_ClientesPorTipoPersona').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesPorTipoPersona').txt(fmt(r.PorcentajeClientes));
        e.ele('SaldoOperaciones_ClientesPorTipoPersona').txt(fmt(r.SaldoOperaciones));
        e.ele('PorcentajeSobreTotalOperaciones_ClientesPorTipoPersona').txt(fmt(r.PorcentajeSobreTotal));
    }

    // CUADRO C2: Naturaleza
    const listaC2 = registro.ele('ListaClientesPorNaturaleza');
    for (const r of C2) {
        const e = listaC2.ele('ElementoClientesPorNaturaleza');
        e.ele('Mes_ClientesPorNaturaleza').txt(num(r.Mes));
        e.ele('TipoNaturalezaActividadEconomicaCliente').txt(num(r.TipoNaturaleza || 1));
        e.ele('NumeroClientes_ClientesPorNaturaleza').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesPorNaturaleza').txt(fmt(r.PorcentajeClientes));
        e.ele('SaldoOperaciones_ClientesPorNaturaleza').txt(fmt(r.SaldoOperaciones));
        e.ele('PorcentajeSobreTotalOperaciones_ClientesPorNaturaleza').txt(fmt(r.PorcentajeSobreTotal));
    }

    // CUADROS D, E, F: Activas, Pasivas y Fuera de Balance (Comparten Estructura)
    const cuadrosDEF = [
        { lista: 'ListaClientesConOperacionesActivas',      elem: 'ElementoClientesConOperacionesActivas',      sufijo: 'ClientesConOperacionesActivas',      data: D },
        { lista: 'ListaClientesConOperacionesPasivas',      elem: 'ElementoClientesConOperacionesPasivas',      sufijo: 'ClientesConOperacionesPasivas',      data: E },
        { lista: 'ListaClientesConOperacionesFueraBalance', elem: 'ElementoClientesConOperacionesFueraBalance', sufijo: 'ClientesConOperacionesFueraBalance', data: F },
    ];
    for (const { lista, elem, sufijo, data } of cuadrosDEF) {
        const lst = registro.ele(lista);
        for (const r of data) {
            const e = lst.ele(elem);
            e.ele(`Mes_${sufijo}`).txt(num(r.Mes));
            e.ele(`TipoRiesgo_${sufijo}`).txt(num(r.C_TipoRiesgo || 1));
            e.ele(`NumeroClientes_${sufijo}`).txt(num(r.NumeroClientes));
            e.ele(`PorcentajeClientes_${sufijo}`).txt(fmt(r.PorcentajeClientes));
            e.ele(`SaldoOperaciones_${sufijo}`).txt(fmt(r.SaldoOperaciones));
            e.ele(`PorcentajeSobreTotalOperaciones_${sufijo}`).txt(fmt(r.PorcentajeSobreTotal));
        }
    }

    // CUADRO G: Operaciones Activas y Pasivas
    const listaG = registro.ele('ListaClientesConOperacionesActivasPasivas');
    for (const r of G) {
        const e = listaG.ele('ElementoClientesConOperacionesActivasPasivas');
        e.ele('Mes_ClientesConOperacionesActivasPasivas').txt(num(r.Mes));
        e.ele('TipoRiesgo_ClientesConOperacionesActivasPasivas').txt(num(r.C_TipoRiesgo || 1));
        e.ele('NumeroClientes_ClientesConOperacionesActivasPasivas').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesConOperacionesActivasPasivas').txt(fmt(r.PorcentajeClientes));
    }

    // CUADRO H: Reclasificados
    const listaH = registro.ele('ListaClientesReclasificadosMes');
    for (const r of H) {
        const e = listaH.ele('ElementoClientesReclasificadosMes');
        e.ele('Mes_ClientesReclasificadosMes').txt(num(r.Mes));
        e.ele('TipoOperacion_ClientesReclasificadosMes').txt(num(r.TipoOperacion || 1));
        e.ele('TipoRiesgo_ClientesReclasificadosMes').txt(num(r.C_TipoRiesgo || 1));
        e.ele('NumeroClientesReclasificados_ClientesReclasificadosMes').txt(num(r.NumeroClientesReclasificados));
    }

    // CUADRO I: Jurisdicción Residencia
    const listaI = registro.ele('ListaClientesJurisdiccionResidencia');
    for (const r of I) {
        const e = listaI.ele('ElementoClientesJurisdiccionResidencia');
        e.ele('Mes_ClientesJurisdiccionResidencia').txt(num(r.Mes));
        e.ele('TipoResidencia_ClientesJurisdiccionResidencia').txt(num(r.TipoResidencia || 1));
        e.ele('TipoRiesgo_ClientesJurisdiccionResidencia').txt(num(r.C_TipoRiesgo || 1));
        e.ele('NumeroClientes_ClientesJurisdiccionResidencia').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesJurisdiccionResidencia').txt(fmt(r.PorcentajeClientes));
        e.ele('SaldosActivos_ClientesJurisdiccionResidencia').txt(fmt(r.SaldosActivos));
        e.ele('SaldosPasivos_ClientesJurisdiccionResidencia').txt(fmt(r.SaldosPasivos));
        e.ele('SaldosFueraBalance_ClientesJurisdiccionResidencia').txt(fmt(r.SaldosFueraBalance));
    }

    // CUADRO J: Sujetos Obligados Art. 15
    const listaJ = registro.ele('ListaSujetosObligadosArticulo15Ley8204');
    for (const r of J) {
        const e = listaJ.ele('ElementoSujetosObligadosArticulo15Ley8204');
        e.ele('Mes_SujetosObligadosArticulo15Ley8204').txt(num(r.Mes));
        e.ele('TipoRiesgo_SujetosObligadosArticulo15Ley8204').txt(num(r.C_TipoRiesgo || 1));
        e.ele('NumeroClientes_SujetosObligadosArticulo15Ley8204').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_SujetosObligadosArticulo15Ley8204').txt(fmt(r.PorcentajeClientes));
    }

    // CUADRO K: PEPs
    const listaK = registro.ele('ListaPersonasExpuestasPoliticamente');
    for (const r of K) {
        const e = listaK.ele('ElementoPersonasExpuestasPoliticamente');
        e.ele('Mes_PersonasExpuestasPoliticamente').txt(num(r.Mes));
        e.ele('TipoRiesgo_PersonasExpuestasPoliticamente').txt(num(r.C_TipoRiesgo || 1));
        e.ele('NumeroClientes_PersonasExpuestasPoliticamente').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_PersonasExpuestasPoliticamente').txt(fmt(r.PorcentajeClientes));
        e.ele('SaldosActivos_PersonasExpuestasPoliticamente').txt(fmt(r.SaldosActivos));
        e.ele('SaldosPasivos_PersonasExpuestasPoliticamente').txt(fmt(r.SaldosPasivos));
        e.ele('SaldosFueraBalance_PersonasExpuestasPoliticamente').txt(fmt(r.SaldosFueraBalance));
    }

    // CUADRO L: Operaciones Mayores a 100 Salarios
    const listaL = registro.ele('ListaClientesOperacionesMayores100');
    for (const r of L) {
        const e = listaL.ele('ElementoClientesOperacionesMayores100');
        e.ele('Mes_OperacionesMayores100').txt(num(r.Mes));
        e.ele('TipoRiesgo_OperacionesMayores100').txt(num(r.C_TipoRiesgo || 1));
        e.ele('NumeroClientes_OperacionesMayores100').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_OperacionesMayores100').txt(fmt(r.PorcentajeClientes));
        e.ele('TotalIngresos_OperacionesMayores100').txt(fmt(r.TotalIngresos));
    }

    const xmlString = root.end({ prettyPrint: true });
    fs.writeFileSync('Sicveca_Reporte.xml', xmlString, 'utf-8');
    console.log('[XML] Sicveca_Reporte.xml generado con la jerarquía estricta SUGEF.');
    return xmlString;
}

module.exports = { generarXMLSicveca };