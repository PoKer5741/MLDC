const sql = require('mssql/msnodesqlv8'); 

const config = {
    connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=POKER;Database=Grupo3_IF51002026;Trusted_Connection=yes;',
    options: {
        trustServerCertificate: true 
    },
    
    connectionTimeout: 60000,  
    requestTimeout: 0,         
    pool: {
        max: 20,               
        min: 5,
        idleTimeoutMillis: 30000
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('[DB] Conectado exitosamente a SQL Server.');
        return pool;
    })
    .catch(err => {
        console.error('[ERROR DB] Fallo critico en la conexion de la instancia:', err.message);
        process.exit(1);
    });

module.exports = { sql, poolPromise };