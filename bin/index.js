const sql = require("mysql");
const { prompt } = require("inquirer");
require("console.table");

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
        name: "name",
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
        message: "Salary ($/yr):",
        validate: validateMoney
    }
],
addEmployeeQ = [
    {
        type: "input",
        name: "first_name",
        message: "First name:"
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
                case "View all departments": await viewDeptList(); break;
                case "View all roles": await viewRoleList(); break;
                case "View all employees": await viewEmpList(); break;
                case "View all employees by manager": await viewManage(); break;
                case "View utilized budget by department": await viewDeptBudget(); break;
                case "Add a department": await addDepartment(); break;
                case "Add a role": await addRole(); break;
                case "Add an employee": await addEmployee(); break;
                case "Update an employee role": await updateRole(); break;
                case "Update an employee manager": await updateManager(); break;
                case "Delete a department": await deleteDept(); break;
                case "Delete a role": await deleteRole(); break;
                case "Delete an employee": await deleteEmp(); break;
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

// View departments
function viewDeptList() {
    return dbQuery("select id, name as department from department_tb order by id")
        .then(departments => {
            if (departments.length) {
                console.table(departments);
            }
            else {
                console.log("There are no departments\n");
            }
        })
        .catch(console.error);
}

// View roles
function viewRoleList() {
    return dbQuery("select role_tb.id, role_tb.title, role_tb.salary, department_tb.name as department from role_tb inner join department_tb on role_tb.department_id = department_tb.id order by id")
        .then(roles => {
            roles.forEach(role => {
                role.salary = role.salary.toFixed(2); // Always show cents
            });
            return roles;
        })
        .then(roles => {
            if (roles.length) {
                console.table(roles);
            }
            else {
                console.log("There are no roles\n");
            }
        })
        .catch(console.error);
}

// View employees
function viewEmpList() {
    return dbQuery("select a.id, a.first_name, a.last_name, role_tb.title, department_tb.name as department, role_tb.salary, b.first_name as manager_first_name, b.last_name as manager_last_name from employee_tb as a left join employee_tb as b on a.manager_id = b.id left join role_tb inner join department_tb on role_tb.department_id = department_tb.id on a.role_id = role_tb.id order by id")
        .then(employees => {
            employees.forEach(emp => {
                emp.salary = emp.salary.toFixed(2); // Always show cents
                emp.manager = (emp.manager_first_name || emp.manager_last_name) === null ? null : `${emp.manager_first_name} ${emp.manager_last_name}` // Format manager name into single column
                delete emp.manager_first_name;
                delete emp.manager_last_name;
            });
            return employees;
        })
        .then(employees => {
            if (employees.length) {
                console.table(employees);
            }
            else {
                console.log("There are no employees\n");
            }
        })
        .catch(console.error);
}

// View employees by manager functionality
function viewManage() {
    return dbQuery("select * from employee_tb order by id")
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
                    choices: Object.keys(managers) // Grab manager list
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
    return dbQuery("select * from department_tb order by id")
        .then(departments => {
            if (departments.length) {
                return prompt({
                    type: "list",
                    name: "name",
                    message: "Department:",
                    choices: departments.map(dept => dept.name) // Convert to department name list
                })
                    .then(response => response.name)
                    .then(department => departments.find(dept => dept.name == department)) // Assume this succeeded
                    .then(department => {
                        return dbQuery("select role_tb.salary from employee_tb inner join role_tb on employee_tb.role_id = role_tb.id where role_tb.department_id = ?", department.id)
                            .then(salaries => salaries.map(item => item.salary))
                            .then(salaries => salaries.reduce((x, y) => x + y)) // Sum of salaries
                            .then(total => `$${total.toFixed(2)}\n`)
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
        .then(response => dbQuery("insert into department_tb (name) values (?)", [response.name]))
        .then(() => console.log("Success!\n"))
        .catch(console.error);
}

// Handle add role functionality
function addRole() {
    return dbQuery("select * from department_tb order by id")
        .then(departments => {
            if (!departments.length) { // Must have departments
                console.log("There are no departments to add roles to\n");
            }
            else {
                return prompt(addRoleQ.concat({ // Prompt questions with current department list
                    type: "list",
                    name: "department",
                    message: "Department:",
                    choices: departments.map(department => department.name) // Convert objects to titles
                }))
                    .then(response => { // Parse data and insert into role_tb
                        return dbQuery(
                            "insert into role_tb (title, salary, department_id) values (?, ?, ?)",
                            [
                                response.title,
                                parseFloat(response.salary),
                                departments.find(department => department.name == response.department).id // Convert title back to id
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
        dbQuery("select id, title from role_tb order by id"),
        dbQuery("select id, first_name, last_name from employee_tb order by id")
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

// Update an employee's role
function updateRole() {
    return Promise.all([ // Asynchronously get employees and roles
        dbQuery("select id, first_name, last_name from employee_tb order by id"),
        dbQuery("select id, title from role_tb order by id")
    ])
        .then(data => ({ // Organize data
            employees: data[0],
            roles: data[1]
        }))
        .then(data => {
            if (!data.roles.length) { // Handle empty tables
                console.log("There are no roles\n");
            }
            else if (!data.employees.length) {
                console.log("There are no employees\n");
            }
            else {
                return prompt([
                    {
                        type: "list",
                        name: "employee",
                        message: "Employee:",
                        choices: data.employees.map(emp => `${emp.first_name} ${emp.last_name}`) // Convert to full name
                    },
                    {
                        type: "list",
                        name: "role",
                        message: "Role:",
                        choices: data.roles.map(role => role.title) // Grab titles
                    }
                ])
                    .then(response => {
                        return dbQuery(
                            "update employee_tb set role_id = ? where id = ?",
                            [
                                data.roles.find(role => response.role == role.title).id, // Convert back to IDs
                                data.employees.find(emp => response.employee == `${emp.first_name} ${emp.last_name}`).id
                            ]
                        );
                    })
                    .then(() => console.log("Success!\n"))
                    .catch(console.error);
            }
        })
        .catch(console.error);
}

// Update an employee's manager
function updateManager() {
    return dbQuery("select id, first_name, last_name from employee_tb order by id")
        .then(employees => {
            if (employees.length) {
                let employeeList = employees.map(emp => `${emp.first_name} ${emp.last_name}`);
                return prompt([
                    {
                        type: "list",
                        name: "employee",
                        message: "Employee:",
                        choices: employeeList
                    },
                    {
                        type: "list",
                        name: "manager",
                        message: "Manager:",
                        choices: (first) => ["N/A"].concat(employeeList.filter(emp => emp != first.employee))
                    }
                ])
                    .then(response => {
                        let manager = employees.find(emp => `${emp.first_name} ${emp.last_name}` == response.manager); // Convert full name to object
                        return dbQuery(
                            "update employee_tb set manager_id = ? where id = ?",
                            [
                                manager ? manager.id : null,
                                employees.find(emp => `${emp.first_name} ${emp.last_name}` == response.employee).id
                            ]
                        );
                    })
                    .then(() => console.log("Success!\n"))
                    .catch(console.error);
            }
            else {
                console.log("There are no employees\n");
            }
        })
        .catch(console.error);
}

// Remove a department
function deleteDept() {
    return dbQuery("select * from department_tb order by id")
        .then(departments => {
            if (departments.length) {
                return prompt({
                    type: "list",
                    name: "name",
                    message: "Department:",
                    choices: departments.map(dept => dept.name) // Grab names
                })
                    .then(response => {
                        return dbQuery(
                            "delete from department_tb where id = ?",
                            departments.find(dept => response.name == dept.name).id // Convert back to ID
                        )
                        .then(() => pruneDeptRoles()); // Roles can't have a null department
                    })
                    .then(() => console.log("Success!\n"))
                    .catch(console.error);
            }
            else {
                console.log("There are no departments\n");
            }
        })
        .catch(console.error);
}

// Remove a role
function deleteRole() {
    return dbQuery("select id, title from role_tb order by id")
        .then(roles => {
            if (roles.length) {
                return prompt({
                    type: "list",
                    name: "title",
                    message: "Role:",
                    choices: roles.map(role => role.title) // Grab role titles
                })
                    .then(response => {
                        return dbQuery(
                            "delete from role_tb where id = ?",
                            roles.find(role => response.title == role.title).id // Convert back to ID
                        )
                            .then(() => pruneRoleEmps()); // Employees can't have null role
                    })
                    .then(() => console.log("Success!\n"))
                    .catch(console.error);
            }
            else {
                console.log("There are no roles\n");
            }
        })
        .catch(console.error);
}

// Remove an employee
function deleteEmp() {
    return dbQuery("select id, first_name, last_name from employee_tb order by id")
        .then(employees => {
            if (employees.length) {
                return prompt({
                    type: "list",
                    name: "name",
                    message: "Employee:",
                    choices: employees.map(emp => `${emp.first_name} ${emp.last_name}`) // Grab whole names
                })
                    .then(response => {
                        let id = employees.find(emp => response.name == `${emp.first_name} ${emp.last_name}`).id; // Grab ID
                        return dbQuery("delete from employee_tb where id = ?", id)
                            .then(() => pruneManagers(id));
                    })
                    .then(() => console.log("Success!\n"))
                    .catch(console.error);
            }
            else {
                console.log("There are no employees\n");
            }
        })
        .catch(console.error);
}

// Clean up roles after deleting a department
function pruneDeptRoles() {
    return dbQuery("delete from role_tb where not department_id in (select id from department_tb)")
        .then(() => pruneRoleEmps())
        .catch(console.error);
}

// Clean up employees after deleting a role
function pruneRoleEmps() {
    return dbQuery("delete from employee_tb where not role_id in (select id from role_tb)")
        .then(() => pruneManagers())
        .catch(console.error);
}

// Clean up managers after deleting an employee
function pruneManagers(id) {
    if (id) {
        return dbQuery("update employee_tb set manager_id = null where manager_id = ?", id)
            .catch(console.error);
    }
    else {
        return dbQuery("select distinct manager_id from employee_tb where not manager_id in (select id from employee_tb)") // SQL doesn't allow updating a table based on itself
            .then(targets => targets.map(emp => emp.manager_id))
            .then(targets => Promise.all(targets.map(pruneManagers)))
            .catch(console.error);
    }
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
        });
    });
}

// Here we go
db.connect(function(error) {
    if (error) throw error;
    else main();
});
