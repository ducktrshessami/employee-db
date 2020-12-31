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

// Questions
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
],
addDepartmentQ = [
    {
        type: "input",
        name: "department_name",
        message: "Department name:"
    }
],
addRoleQ = [
    {
        type: "input",
        name: "title",
        message: "Role title:"
    },
    {
        type: "input",
        name: "salary",
        message: "Salary ($):",
        validate: validateMoney
    }
],
addEmployeeQ = [
    {
        type: "input",
        name: "first_name",
        message: "Employee first name:"
    },
    {
        type: "input",
        name: "last_name",
        message: "Last name:"
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
                case "View utilized budget by department": await viewDeptBudget(); break;
                case "Add a department": await addDepartment(); break;
                case "Add a role": await addRole(); break;
                case "Add an employee": await addEmployee(); break;
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
        })
        .catch(console.error);
}

// Print a table from the db
function printTb(table) {
    return dbQuery(`select * from ${table} order by id`)
        .then(response => {
            if (response.length) {
                console.table(response);
            }
            else {
                console.log(`${table} is empty\n`);
            }
        })
        .catch(console.error);
}

// View employees by manager functionality
function viewManage() {
    return dbQuery("select * from employee_tb")
        .then(response => {
            let managers = {};
            response.forEach(employee => { // Group employees by their manager
                if (employee.manager_id !== null) {
                    let manager = response.find(e => e.id == employee.manager_id);
                    if (manager) {
                        let name = `${manager.first_name} ${manager.last_name}`;
                        if (!managers[name]) {
                            managers[name] = [];
                        }
                        managers[name].push(employee);
                    }
                }
            });
            if (Object.keys(managers).length) {
                return prompt({
                    type: "list",
                    name: "name",
                    message: "Manager:",
                    choices: Object.keys(managers)
                })
                    .then(manager => managers[manager.name])
                    .then(console.table)
                    .catch(console.error);
            }
            else {
                console.log("There are no employees with managers\n");
            }
        })
        .catch(console.error);
}

// Calculate a department's total utilized budget
function viewDeptBudget() {
    return dbQuery("select * from department_tb")
        .then(departments => {
            if (departments.length) {
                return prompt({
                    type: "list",
                    name: "department_name",
                    message: "Department:",
                    choices: departments.map(dept => dept.department_name)
                })
                    .then(response => response.department_name)
                    .then(department => departments.find(dept => dept.department_name == department)) // Assume this succeeded
                    .then(department => {
                        return dbQuery("select role_tb.salary from employee_tb inner join role_tb on employee_tb.role_id = role_tb.id where role_tb.department_id = ?", department.id)
                            .then(salaries => salaries.map(item => item.salary))
                            .then(salaries => salaries.reduce((x, y) => x + y))
                            .then(total => `$${total.toFixed(2)}`)
                            .then(console.log)
                            .catch(console.error);
                    })
                    .catch(console.error);
            }
            else {
                console.log("There are no departments\n");
            }
        })
        .catch(console.error);
}

// Handle add department functionality
function addDepartment() {
    return prompt(addDepartmentQ)
        .then(response => dbQuery("insert into department_tb (department_name) values (?)", [response.department_name]))
        .then(() => console.log("Success!\n"))
        .catch(console.error);
}

// Handle add role functionality
function addRole() {
    return dbQuery("select * from department_tb")
        .then(departments => {
            if (!departments.length) { // Must have departments
                console.log("There are no departments to add roles to\n");
            }
            else {
                return prompt(addRoleQ.concat({ // Prompt questions with current department list
                    type: "list",
                    name: "department",
                    message: "Department:",
                    choices: departments.map(department => department.department_name) // Convert objects to titles
                }))
                    .then(response => { // Parse data and insert into role_tb
                        return dbQuery(
                            "insert into role_tb (title, salary, department_id) values (?, ?, ?)",
                            [
                                response.title,
                                parseFloat(response.salary),
                                departments.find(department => department.department_name == response.department).id // Convert title back to id
                            ]
                        );
                    })
                    .then(() => console.log("Success!\n"))
                    .catch(console.error);
            }
        })
        .catch(console.error);
}

// Handle add employee functionality
function addEmployee() {
    return Promise.all([ // Asynchronously get roles and employees
        dbQuery("select id, title from role_tb"),
        dbQuery("select id, first_name, last_name from employee_tb")
    ])
        .then(data => ({ // Organize roles and employees into an object
            roles: data[0],
            employees: data[1]
        }))
        .then(data => {
            if (!data.roles.length) { // Must have roles
                console.log("There are no roles for an employee to be\n");
            }
            else {
                let questions = addEmployeeQ.concat({ // Initialize question list with current role list
                    type: "list",
                    name: "role",
                    message: "Role:",
                    choices: data.roles.map(role => role.title)
                });
                if (data.employees.length) { // Manager selection question if there are employees to be managers
                    questions = questions.concat({
                        type: "list",
                        name: "manager",
                        message: "Manager:",
                        choices: ["N/A"].concat(data.employees.map(employee => `${employee.first_name} ${employee.last_name}`)) // Convert objects to full names
                    });
                }
                return prompt(questions) // Prompt and parse
                    .then(response => {
                        let manager = data.employees.find(employee => `${employee.first_name} ${employee.last_name}` == response.manager); // Convert full name to object
                        return dbQuery(
                            "insert into employee_tb (first_name, last_name, role_id, manager_id) values (?, ?, ?, ?)",
                            [
                                response.first_name,
                                response.last_name,
                                data.roles.find(role => role.title == response.role).id, // Convert title to id
                                manager ? manager.id : null // Pass id or null if no id
                            ]
                        );
                    })
                    .then(() => console.log("Success!\n"))
                    .catch(console.error);
            }
        })
        .catch(console.error);
}

// Validate money input
function validateMoney(input) {
    let number = parseFloat(input);
    return (number && ((number * 100) % 1 == 0)) || "Please enter a valid salary";
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
