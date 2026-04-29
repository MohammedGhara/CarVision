# 🚗 CarVision

## Project Overview

**CarVision** is a full-stack mobile application designed to help car owners manage their vehicles, find nearby garages, communicate with service providers, and access smart car support through diagnostics and AI assistance.

The project connects a **React Native mobile app** with an **Express.js backend**, **PostgreSQL database**, **Prisma ORM**, authentication, location-based garage search, messaging, marketplace features, and WebSocket-based OBD-II diagnostic simulation.

CarVision was built as a practical software engineering project focused on solving a real-world problem in the automotive service industry.

---

## ✨ Key Features

- **Authentication & Roles**: Secure login/signup with JWT authentication and role-based access for Clients, Garages, and Admins.
- **Vehicle Management**: Add, view, and manage vehicles with repair status tracking.
- **Nearby Garages**: Find garages near the user using location services and distance calculation.
- **Navigation Support**: Open garage directions using Waze, Google Maps, or web fallback.
- **Messaging System**: Chat between clients and garages with support for text and media messages.
- **Garage Marketplace**: Garages can publish products or services, including prices and images.
- **OBD-II Diagnostics**: Real-time diagnostic flow using WebSocket and fake ELM327 simulator for testing.
- **AI Car Assistant**: Helps users understand common vehicle issues and ask car-related questions.
- **Multi-Language Support**: Supports English, Arabic, and Hebrew.

---

## 🎯 Target Users

- **Clients**: Manage vehicles, find garages, contact service providers, and track repair progress.
- **Garages**: Manage customer vehicles, communicate with clients, and publish marketplace listings.
- **Admins**: Manage users and support platform operations.

---

## 🛠️ Technology Stack

- **Frontend**: React Native, Expo, Expo Router, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT, bcryptjs
- **Real-Time Communication**: WebSocket
- **File Uploads**: Multer
- **Location Services**: Expo Location
- **Development Tools**: Git, GitHub, npm, Prisma CLI, Expo Go, Postman

---

## 📁 Project Structure

```txt
CarVision/
├── apps/
│   ├── mobile/
│   │   ├── app/
│   │   ├── context/
│   │   ├── lib/
│   │   ├── styles/
│   │   └── package.json
│   │
│   └── server/
│       ├── server.js
│       ├── prisma/
│       │   └── schema.prisma
│       ├── src/
│       │   ├── auth.js
│       │   └── routes/
│       ├── uploads/
│       └── fake_elm327.js
```

---

## 🔗 How It Works

The mobile app communicates with the backend through a centralized API layer.

```txt
Mobile App
   ↓
API Layer
   ↓
Express.js Backend
   ↓
Prisma ORM
   ↓
PostgreSQL Database
```

For protected routes, the app sends the JWT token in the request header:

```txt
Authorization: Bearer <token>
```

The backend validates the token and checks the user role before allowing access to protected resources.

---

## 🔌 Diagnostics Flow

```txt
ELM327 Device / Simulator
        ↓
Backend TCP Connection
        ↓
WebSocket Server
        ↓
Mobile Diagnostics Screen
```

The project includes a fake ELM327 simulator, allowing diagnostic testing without a real vehicle device.

---

## 🚀 Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/carvision.git
cd carvision
```

### 2. Install Mobile Dependencies

```bash
cd apps/mobile
npm install
```

### 3. Install Backend Dependencies

```bash
cd ../server
npm install
```

If needed, install the backend packages manually:

```bash
npm init -y
npm install express cors bcryptjs jsonwebtoken prisma @prisma/client multer ws dotenv
npm install --save-dev nodemon
```

### 4. Setup the Database

```bash
cd apps/server
npx prisma generate
npx prisma migrate dev
```

### 5. Run the Backend

```bash
node server.js
```

Backend URL:

```txt
http://localhost:5173
```

Health check:

```txt
http://localhost:5173/api/ping
```

### 6. Run the Mobile App

```bash
cd apps/mobile
npm start
```

Open the app using Expo Go, Android emulator, or iOS simulator.

### 7. Run Fake ELM327 Simulator

```bash
cd apps/server
node fake_elm327.js
```

---

## 📈 Project Workflow

- Designed database models using Prisma
- Built backend REST API routes
- Connected mobile screens to backend API
- Added JWT authentication and role-based access
- Integrated location-based garage search
- Added messaging and marketplace functionality
- Implemented WebSocket diagnostic simulation
- Tested the app using Expo and API testing tools

---

## 👥 Team Members

- **Mosab Shaker** – Developer
- **Mohammed Gara** – Developer

---

## 📄 Documentation

For more details, refer to the project source code and Prisma schema.

---

## 👨‍💻 Developers

Developed by **Mosab Shaker** and **Mohammed Gara**.

CarVision was built as a real-world full-stack software engineering project combining mobile development, backend APIs, database design, authentication, geolocation, messaging, marketplace functionality, and real-time diagnostics.

---

## 📄 License

This project is developed for educational and portfolio purposes.
