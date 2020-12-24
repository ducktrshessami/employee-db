const sql = require("mysql");
const inquirer = require("inquirer");

const db = sql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: require("./password"),
    database: "employee_db"
});

function main() {
    
}

db.connect(function(err) {
    if (err) throw err;
    else main();
});
