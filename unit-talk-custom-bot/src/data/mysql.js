const fs = require('fs')
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const mysql = require("mysql2/promise");
require('dotenv').config()

const pool = mysql.createPool({
  host: process.env.DbHost,
  user: process.env.DbUsername,
  database: process.env.database,
  password: process.env.DbPassword,
  waitForConnections: true,
  connectionLimit: 20,

});

async function queryExecute(query, params = null) {
  try {
    const connection = await pool.getConnection();

    let rows;
    if (params) {
      [rows] = await connection.execute(query, params); 
    } else {
      [rows] = await connection.query(query); 
    }

    connection.release();
    return rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error; 
  }
}

async function loadData() {
console.log(`[MYSQL] Connecting and loading schemas`)
await queryExecute('CREATE TABLE IF NOT EXISTS Level (Guild_id VARCHAR(255), User_id VARCHAR(255), XP BIGINT, Level BIGINT)')
await queryExecute(`CREATE TABLE IF NOT EXISTS LevelRoles (Guild_id VARCHAR(255), Level BIGINT, Role_id VARCHAR(255))`)
 await queryExecute(`CREATE TABLE IF NOT EXISTS LiveSports (Id VARCHAR(255), Sport_key VARCHAR(255), Home_team VARCHAR(255), Away_team VARCHAR(255),BookMakers JSON, Commence_time BIGINT, ThreadId VARCHAR (255))`)
 await queryExecute(`CREATE TABLE IF NOT EXISTS Modlogs (Guild_id VARCHAR(255), User_id VARCHAR(255), Moderator_id VARCHAR(255), Punishment_type VARCHAR(255), Reason VARCHAR(255), Timestamp BIGINT)`)
 await queryExecute(`CREATE TABLE IF NOT EXISTS DailyQues (Id INT(50), Question LONGTEXT, Active BOOLEAN)`)
 await queryExecute(`CREATE TABLE IF NOT EXISTS EngagmentStats (Guild_id VARCHAR(255), User_id VARCHAR(255), Messages BIGINT, Reactions BIGINT)`)
 await queryExecute(`CREATE TABLE IF NOT EXISTS FirstTimePost (Guild_id VARCHAR(255), User_id VARCHAR(255), FirstTime BOOLEAN)`)
 await queryExecute(`CREATE TABLE IF NOT EXISTS SportsPick (Id BIGINT AUTO_INCREMENT PRIMARY KEY,User_id VARCHAR(255), Sport VARCHAR(255), Teams LONGTEXT, Pick VARCHAR(255),Units VARCHAR(255),Odds VARCHAR(255),Bet_type VARCHAR(255), Book LONGTEXT, Notes LONGTEXT, Result VARCHAR(255),Date VARCHAR(255), Access_tier VARCHAR(255) )`)
 console.log(`[MYSQL] Connected and loaded schemas`)
}
loadData()

module.exports = {
  queryExecute
}
