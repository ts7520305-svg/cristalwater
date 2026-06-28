CRISTAL WATER CONTEXT

Stack

* Backend: Node.js + Express
* Database: Supabase PostgreSQL
* ORM: Prisma
* Process Manager: PM2
* AI: OpenAI
* Frontend: HTML + JS + PWA

Main Modules

* Clients
* Pools
* Technical Sheet
* Service Visits
* Technicians
* Billing
* Payments
* GPS
* Alerts
* Chat
* Customer Portal
* Stock
* Keys
* AI Admin
* AI Technician

AI Architecture

AI Admin

Can access:

* Clients
* Pools
* Visits
* Billing
* Payments
* GPS
* Alerts
* Stock

Can:

* Answer questions
* Generate alerts
* Generate tasks
* Suggest actions

Needs approval before changing data.

AI Technician

Can access only:

* Assigned visits
* Assigned pools
* Technical information

Cannot access:

* Billing
* Payments
* Client financial information

Purpose:

* Technical support
* Water chemistry
* Equipment diagnostics
* Repair guidance

AI Tables

* AiAdminConversation
* AiTask

Current Status

* Supabase connected
* Prisma synchronized
* PM2 online
* OpenAI key configured
* First AI tables created