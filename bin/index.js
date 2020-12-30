const sql = require("mysql");
const { prompt } = require("inquirer");
const cTable = require("console.table");

const db = sql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: require("./password"),
    database: "employee_db"
});

const entryQ = [
    {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
            "View all departments",
            "View all roles",
            "View all employees",
            "View all employees by manager",
            "View utilized budget by department",
            "Add a department",
            "Add a role",
            "Add an employee",
            "Update an employee role",
            "Update an employee manager",
            "Delete a department",
            "Delete a role",
            "Delete an employee",
            "Exit"
        ]
    }
];

// CLI
function main() {
    prompt(entryQ)
        .then(async response => {
            let cont = true;
            switch (response.action) {
                case "View all departments": await printTb("department_tb"); break;
                case "View all roles": await printTb("role_tb"); break;
                case "View all employees": await printTb("employee_tb"); break;
                case "View all employees by manager": await viewManage(); break;
                case "View utilized budget by department":
                case "Add a department":
                case "Add a role":
                case "Add an employee":
                case "Update an employee role":
                case "Update an employee manager":
                case "Delete a department":
                case "Delete a role":
                case "Delete an employee":
                default: cont = false; break;
            }
            if (cont) {
                main();
            }
            else {
                db.end();
            }
        });
}

// Print a table from the db
function printTb(table) {
    return dbQuery(`select * from ${table} order by id`)
        .then(response => {
            if (response.length) {
                console.table(response);
            }
            else {
                console.log(`${table} is empty`);
            }
        })
        .catch(console.error);
}

// Promisified db.query
function dbQuery(query, values) {
    return new Promise((resolve, reject) => {
        db.query(query, values, (error, results) => {
            if (error) reject(error);
            else resolve(results);
        })
    });
}

// Here we go
db.connect(function(error) {
    if (error) throw error;
    else main();
});
