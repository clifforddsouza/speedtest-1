# Network Performance Testing Application

A comprehensive network performance testing application that provides real-world network diagnostics and insights.

## Features

- Real-time speed testing (download and upload)
- Latency/ping measurement
- Jitter measurement
- Packet loss detection
- Customer ID tracking
- Secure admin dashboard with role-based authentication
- Advanced analytics and reporting
- History tracking of test results
- Customizable test locations

## Technologies Used

- **Frontend**: React, TypeScript, TanStack Query, Shadcn UI components
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js
- **Real-time Communication**: WebSockets

## User Types and Permissions

- **Regular Users**: Can perform speed tests and view their own results
- **Managers**: Can access basic admin features and view customer data
- **Admins**: Full access to all customer data and reports
- **Super Admins**: System configuration and user management capabilities

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database

### Installation

1. Clone the repository
```bash
git clone https://github.com/clifforddsouza/speedtest-1.git
cd speedtest-1
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```
DATABASE_URL=postgresql://username:password@localhost:5432/speedtest
```

4. Initialize the database
```bash
npm run db:push
```

5. Start the application
```bash
npm run dev
```

## Default Admin Login

- Username: `admin`
- Password: `password`

*Note: For security reasons, please change the default credentials after the first login.*

## License

This project is licensed under the MIT License - see the LICENSE file for details.