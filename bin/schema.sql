drop database if exists employee_db;
create database employee_db;
use employee_db;

create table department_tb(
    id int primary key auto_increment,
    d_name varchar(30) not null
);

create table role_tb(
    id int primary key auto_increment,
    title varchar(30) not null,
    salary decimal(10, 2),
    department_id int not null
);

create table employee_tb(
	id int primary key auto_increment,
    first_name varchar(30) not null,
    last_name varchar(30) not null,
    role_id int not null,
    manager_id int
);
